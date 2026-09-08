import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createFullMatchFixture } from '../fixtures/full-match.ts';
import { createPassingFixture } from '../fixtures/passing.ts';
import { createCarryAndChipFixture } from '../fixtures/carry-and-chip.ts';
import { readRecordingStream } from '../recording/validate.ts';
import type { Recording } from '../recording/record.ts';

const catalogSchema = z.strictObject({
  version: z.literal(1),
  matches: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
        file: z.string().regex(/^[a-zA-Z0-9-]{1,80}\.json\.gz$/),
        title: z.string().max(100),
        complete: z.boolean(),
      }),
    )
    .max(100),
});
export type MatchListing = z.infer<typeof catalogSchema>['matches'][number];
async function fetchMatch(entry: MatchListing, signal?: AbortSignal): Promise<Recording> {
  const response = await fetch(`/matches/${entry.file}`, signal ? { signal } : {});
  if (!response.ok || !response.body) throw new Error('Could not load the selected match');
  // Fetch already decodes HTTP Content-Encoding; plain static hosts may serve raw .gz bytes.
  const stream = response.headers.get('Content-Encoding')?.includes('gzip')
    ? response.body
    : response.body.pipeThrough(new DecompressionStream('gzip'));
  const recording = await readRecordingStream(stream);
  if (recording.initial.matchId !== entry.id)
    throw new Error('Match file does not match its catalogue entry');
  return recording;
}
export function useRecordings() {
  const [recording, setRecording] = useState(createPassingFixture);
  const [matches, setMatches] = useState<MatchListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    async function loadDefault() {
      try {
        const response = await fetch('/matches/index.json', { signal: abort.signal });
        if (!response.ok) throw new Error('Could not read the match catalogue');
        const catalog = catalogSchema.parse(await response.json());
        if (abort.signal.aborted) return;
        setMatches(catalog.matches);
        const latest = catalog.matches.find((entry) => entry.complete) ?? catalog.matches[0];
        if (latest) {
          setLoading(true);
          const match = await fetchMatch(latest, abort.signal);
          if (!abort.signal.aborted) setRecording(match);
        }
      } catch (error) {
        if (!abort.signal.aborted)
          setLoadError(error instanceof Error ? error.message : 'Could not load recording');
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void loadDefault();
    return () => abort.abort();
  }, []);
  const selectRecording = useCallback(
    async (id: string) => {
      setLoadError('');
      if (id === 'full' || id === 'passing' || id === 'carry-and-chip') {
        const fixture =
          id === 'full'
            ? createFullMatchFixture
            : id === 'carry-and-chip'
              ? createCarryAndChipFixture
              : createPassingFixture;
        setRecording(fixture());
        return;
      }
      const entry = matches.find((candidate) => candidate.id === id);
      if (!entry) return;
      setLoading(true);
      try {
        setRecording(await fetchMatch(entry));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load recording');
      } finally {
        setLoading(false);
      }
    },
    [matches],
  );
  const importRecording = useCallback(async (file: File) => {
    setLoading(true);
    setLoadError('');
    try {
      const stream = file.name.endsWith('.gz')
        ? file.stream().pipeThrough(new DecompressionStream('gzip'))
        : file.stream();
      setRecording(await readRecordingStream(stream));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Invalid recording file');
    } finally {
      setLoading(false);
    }
  }, []);
  return { recording, matches, loading, loadError, selectRecording, importRecording };
}
