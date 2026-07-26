import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_URL } from './supabase.js';

/**
 * Background music for the stage.
 *
 * Three tracks in a public Storage bucket, chosen by shuffle rather than by a
 * playlist order. Served from Supabase rather than bundled because 12MB of
 * audio in the Vite build would be 12MB every visitor downloads before the
 * first screen paints, whether or not they ever press play. `preload: 'none'`
 * means a visitor who leaves the music off pays nothing at all for it.
 *
 * A track loops on itself rather than advancing to the next one when it ends —
 * this is room tone sitting under a five-minute session, not a playlist to be
 * carried along by, so the change in what is playing should only ever be the
 * writer's own choice, made with the shuffle button.
 *
 * The filenames are the stock library's own slugs, kept rather than tidied: they
 * are the only record of which track came from where, and PSD 3.5 wants the
 * rights on every piece of media settled before the pitch. [VERIFY the licence
 * on these three before demo day — they are stock lofi, not public domain.]
 */

const TRACKS = [
  'alex-morgan-lofi-cocktail-bar-568153.mp3',
  'apalonbeats-lofi-lofi-music-lofi-chill-2-560425.mp3',
  'alex-morgan-lofi-study-rainy-night-568166.mp3',
];

const SOURCE = `${SUPABASE_URL}/storage/v1/object/public/music`;

/** Under the writing, not level with it. This is a room tone, not a playlist. */
const VOLUME = 0.34;

const REMEMBER = 'mango:music';

/** localStorage throws outright in some private-browsing modes. It is a
 *  preference, so losing it is not worth a broken screen. */
const remember = (value) => {
  try {
    localStorage.setItem(REMEMBER, value);
  } catch {
    /* not worth handling */
  }
};

const remembered = () => {
  try {
    return localStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
};

/**
 * Fisher–Yates, with the track that just finished kept out of first place so a
 * reshuffle never plays the same thing twice in a row. With three tracks that
 * would otherwise happen about a third of the time.
 */
function shuffled(avoidFirst) {
  const order = [...TRACKS];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.length > 1 && order[0] === avoidFirst) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export function useMusic() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const currentRef = useRef(null);

  /** One element for the life of the tab, built on first use rather than on
   *  import so nothing is constructed for a visitor who never presses play. */
  const element = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.volume = VOLUME;
      el.preload = 'none';
      // Native looping restarts the same file with no gap and no JS in the way.
      // A looping track never fires 'ended', so this is also why nothing here
      // listens for that event to pick a next track.
      el.loop = true;
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  /** Moves to the head of the queue, refilling it when it runs dry. */
  const advance = useCallback(() => {
    const el = element();
    if (queueRef.current.length === 0) queueRef.current = shuffled(currentRef.current);

    const next = queueRef.current.shift();
    currentRef.current = next;
    el.src = `${SOURCE}/${encodeURIComponent(next)}`;
    return el.play();
  }, [element]);

  const start = useCallback(async () => {
    try {
      await advance();
      setPlaying(true);
      remember('on');
    } catch {
      // Autoplay policy, or a track that will not load. Either way the control
      // must not claim to be playing something that is not playing.
      setPlaying(false);
    }
  }, [advance]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    remember('off');
  }, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  /** Reshuffle and move on. Starts the music if it was off — pressing shuffle
   *  in silence means "play something", not "reorder a queue you cannot hear". */
  const shuffle = useCallback(() => {
    queueRef.current = shuffled(currentRef.current);
    start();
  }, [start]);

  /**
   * Resume the preference across reloads. Browsers block playback that no
   * gesture asked for, so this succeeds only where the visitor has already
   * interacted with the origin; where it is blocked the promise rejects, the
   * control stays off, and nothing is said about it.
   */
  useEffect(() => {
    if (remembered() === 'on') start();
  }, [start]);

  /** Silence the tab when the component goes, so a hot reload leaves nothing
   *  playing underneath the new one. */
  useEffect(() => () => audioRef.current?.pause(), []);

  return { playing, toggle, shuffle };
}
