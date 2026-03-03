'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Film, Rocket } from 'lucide-react';
import { VideoResource } from './personalized-types';

type VideoStudioSectionProps = {
  videoResources: VideoResource[];
  courseTitle: string;
  nextCourseSlug: string | null;
  nextCourseTitle: string | null;
  videoBlocksCompleted: number[];
  onVideoStarted: (sourceUrl: string) => void;
  onMarkVideoBlockCompleted: (index: number) => void;
  onOpenCheckpoint: () => void;
};

export default function VideoStudioSection({
  videoResources,
  courseTitle,
  nextCourseSlug,
  nextCourseTitle,
  videoBlocksCompleted,
  onVideoStarted,
  onMarkVideoBlockCompleted,
  onOpenCheckpoint,
}: VideoStudioSectionProps) {
  return (
    <section className="xl:col-span-8 rounded-xl border bg-card p-4 lg:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold inline-flex items-center gap-2 text-base">
          <Film className="h-4.5 w-4.5 text-primary" /> Studio Vidéo
        </h3>
        {nextCourseSlug && (
          <Link
            href={`/courses/${nextCourseSlug}`}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Rocket className="h-3.5 w-3.5" /> Suivant: {nextCourseTitle}
          </Link>
        )}
      </div>

      {videoResources.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune vidéo disponible pour ce cours.</p>
      ) : (
        <div className="space-y-3">
          {videoResources.map((resource, index) => (
            <article key={resource.embedUrl} className="rounded-lg border bg-background/90 p-3 space-y-3">
              <p className="text-[11px] text-muted-foreground">Séquence {index + 1}</p>
              <div className="rounded-lg overflow-hidden border bg-background">
                <iframe
                  className="w-full aspect-video"
                  src={resource.embedUrl}
                  title={`Vidéo ${index + 1} - ${courseTitle}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={resource.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Ouvrir sur YouTube
                </a>
                <Button variant="secondary" onClick={() => onVideoStarted(resource.sourceUrl)} className="h-8 text-xs">
                  J’ai lancé cette vidéo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onMarkVideoBlockCompleted(index);
                    onOpenCheckpoint();
                  }}
                  className="h-8 text-xs"
                >
                  Bloc {index + 1} terminé → Checkpoint
                </Button>
                {videoBlocksCompleted.includes(index) && (
                  <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    Bloc validé
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
