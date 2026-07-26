import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeRecording } from './transcription.js';

/**
 * Microphone capture, and the transcript it turns into.
 *
 *   idle          nothing is running
 *   recording     the mic is open and audio is being collected
 *   transcribing  the mic is closed and the recording is being read
 *
 * There is no device picker. The browser's own permission prompt is the
 * microphone chooser, and asking again in our UI would be a second decision
 * about the same thing. If there is no microphone, or permission is refused,
 * that is an ordinary outcome and not an error state to sit in: the caller is
 * told, and the hook goes back to idle so the writer can carry on typing.
 */
export function useVoiceRecorder({ onTranscript, onError } = {}) {
  const [status, setStatus] = useState('idle');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelledRef = useRef(false);
  const liveRef = useRef(true);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      release();
    };
  }, [release]);

  const fail = useCallback(
    (err) => {
      release();
      if (liveRef.current) setStatus('idle');
      onError?.(err);
    },
    [onError, release],
  );

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail(new Error('This browser cannot record audio'));
      return;
    }

    cancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Unmounted, or cancelled, while the permission prompt was open.
      if (!liveRef.current || cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener('stop', async () => {
        const chunks = chunksRef.current;
        const type = recorder.mimeType || 'audio/webm';
        release();

        if (cancelledRef.current || chunks.length === 0) {
          if (liveRef.current) setStatus('idle');
          return;
        }

        try {
          const transcript = await transcribeRecording(new Blob(chunks, { type }));
          if (liveRef.current) setStatus('idle');
          if (transcript.trim()) onTranscript?.(transcript.trim());
        } catch (err) {
          fail(err);
        }
      });

      recorder.start();
      setStatus('recording');
    } catch (err) {
      fail(err);
    }
  }, [fail, onTranscript, release]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return;
    setStatus('transcribing');
    recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else release();
    setStatus('idle');
  }, [release]);

  return { status, start, stop, cancel };
}
