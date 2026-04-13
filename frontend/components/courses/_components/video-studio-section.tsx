'use client';

import Link from 'next/link';
import { Film, Rocket, PlayCircle, CheckCircle2, ExternalLink } from 'lucide-react';
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
    <section className="border-2 border-[#1C293C] bg-[#FBFBF9] p-4 lg:p-5 space-y-4 shadow-[5px_5px_0px_0px_#1C293C]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-black text-base text-[#1C293C] inline-flex items-center gap-2">
          <Film className="h-4 w-4" /> Studio Vidéo
        </h3>
        {nextCourseSlug && (
          <Link
            href={`/courses/${nextCourseSlug}`}
            className="inline-flex items-center gap-2 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
          >
            <Rocket className="h-3.5 w-3.5" />
            Suivant : {nextCourseTitle}
          </Link>
        )}
      </div>

      {videoResources.length === 0 ? (
        <div className="border-2 border-dashed border-[#1C293C]/30 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#1C293C]/40">Aucune vidéo disponible pour ce cours.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videoResources.map((resource, index) => {
            const isDone = videoBlocksCompleted.includes(index);
            return (
              <article
                key={resource.embedUrl}
                className={`border-2 border-[#1C293C] bg-white p-4 space-y-3 shadow-[3px_3px_0px_0px_#1C293C] ${isDone ? 'border-l-4 border-l-[#16A34A]' : ''}`}
              >
                {/* Sequence label */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
                    Séquence {index + 1}
                  </p>
                  {isDone && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#16A34A]">
                      <CheckCircle2 className="h-3 w-3" /> Bloc validé
                    </span>
                  )}
                </div>

                {/* Video player */}
                <div className="border-2 border-[#1C293C] overflow-hidden">
                  <iframe
                    className="w-full aspect-video block"
                    src={resource.embedUrl}
                    title={`Vidéo ${index + 1} — ${courseTitle}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={resource.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                  >
                    <ExternalLink className="h-3 w-3" /> YouTube
                  </a>

                  <button
                    onClick={() => onVideoStarted(resource.sourceUrl)}
                    className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                  >
                    <PlayCircle className="h-3 w-3" /> J&apos;ai lancé
                  </button>

                  <button
                    onClick={() => {
                      onMarkVideoBlockCompleted(index);
                      onOpenCheckpoint();
                    }}
                    className="inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-[#FDC800] px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-100"
                  >
                    Bloc {index + 1} terminé → Checkpoint
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
