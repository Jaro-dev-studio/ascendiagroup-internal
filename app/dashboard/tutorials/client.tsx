"use client";

import { useState } from "react";
import Image from "next/image";
import { PlayCircle, Clock, CheckCircle2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  wistiaId: string;
  category: string;
  thumbnailUrl: string | null;
}

function WistiaPlayer({ wistiaId, autoPlay = false }: { wistiaId: string; autoPlay?: boolean }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary-900">
      <iframe
        src={`https://fast.wistia.net/embed/iframe/${wistiaId}?videoFoam=true${autoPlay ? "&autoPlay=true" : ""}`}
        title="Wistia video player"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  );
}

function TutorialCard({ tutorial, onPlay }: { tutorial: Tutorial; onPlay: () => void }) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div 
        className="relative aspect-video cursor-pointer bg-secondary-100"
        onClick={onPlay}
      >
        {/* Thumbnail Image */}
        {tutorial.thumbnailUrl && (
          <Image
            src={tutorial.thumbnailUrl}
            alt={tutorial.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-secondary-900/20 transition-colors group-hover:bg-secondary-900/30">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform group-hover:scale-110">
            <PlayCircle className="size-8" />
          </div>
        </div>
        
        {/* Duration badge */}
        <div className="absolute bottom-3 right-3">
          <Badge variant="secondary" className="bg-secondary-900/80 text-white">
            <Clock className="mr-1 size-3" />
            {tutorial.duration}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <Badge variant="outline" className="mb-2 text-xs">
              {tutorial.category}
            </Badge>
            <h3 className="font-semibold text-secondary-900">{tutorial.title}</h3>
          </div>
        </div>
        
        <p className="line-clamp-2 text-sm text-secondary-500">
          {tutorial.description}
        </p>

        <Button 
          variant="ghost" 
          className="mt-2 w-full justify-start text-primary-600 hover:bg-primary-50 hover:text-primary-700"
          onClick={onPlay}
        >
          <PlayCircle className="mr-2 size-4" />
          Watch Tutorial
        </Button>
      </div>
    </Card>
  );
}

interface TutorialsClientProps {
  tutorials: Tutorial[];
}

export function TutorialsClient({ tutorials }: TutorialsClientProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-500">
            <PlayCircle className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-secondary-900">Tutorials</h1>
            <p className="text-sm text-secondary-500">
              Learn how to get the most out of Jaro.dev Studio
            </p>
          </div>
        </div>
      </div>

      {/* Quick tips */}
      <Card className="border-primary-200 bg-primary-50">
        <div className="flex items-start gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-500">
            <CheckCircle2 className="size-4 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-primary-900">Get Started Quickly</h3>
            <p className="mt-0.5 text-sm text-primary-700">
              Watch our tutorials to learn how to submit feature requests, track progress, and communicate effectively with our team.
            </p>
          </div>
        </div>
      </Card>

      {/* Tutorial Grid */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-secondary-900">All Tutorials</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              onPlay={() => setSelectedTutorial(tutorial)}
            />
          ))}
        </div>
      </div>

      {/* Empty state for when more tutorials are added */}
      {tutorials.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <div className="flex size-16 items-center justify-center rounded-full bg-secondary-100">
            <PlayCircle className="size-8 text-secondary-400" />
          </div>
          <div className="text-center">
            <h3 className="font-medium text-secondary-900">No tutorials yet</h3>
            <p className="mt-1 text-sm text-secondary-500">
              Check back soon for helpful video guides
            </p>
          </div>
        </div>
      )}

      {/* Video Modal */}
      <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          {selectedTutorial && (
            <>
              <div className="flex items-center justify-between border-b border-secondary-200 p-4">
                <div>
                  <Badge variant="outline" className="mb-1 text-xs">
                    {selectedTutorial.category}
                  </Badge>
                  <h2 className="text-lg font-semibold text-secondary-900">
                    {selectedTutorial.title}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTutorial(null)}
                  className="size-8"
                >
                  <X className="size-4" />
                </Button>
              </div>
              
              <div className="p-4">
                <WistiaPlayer wistiaId={selectedTutorial.wistiaId} autoPlay />
              </div>
              
              <div className="border-t border-secondary-200 p-4">
                <p className="text-sm text-secondary-600">
                  {selectedTutorial.description}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
