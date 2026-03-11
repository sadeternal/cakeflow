import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTour } from '@/lib/TourContext';

export default function TourDialog() {
  const {
    activeTour,
    open,
    handleClose,
    handleDontShowAgain,
    handleIconsChoice,
    currentSlide,
    setCurrentSlide,
  } = useTour();

  if (!activeTour?.slides?.length) return null;

  const slides = activeTour.slides;
  const tourId = activeTour.tourId;
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;
  const isFirst = currentSlide === 0;
  const Icon = slide?.icon;
  const isChoiceSlide = !!slide?.isChoiceSlide;

  // Non-choice slides for dots (skip choice slide)
  const hasChoiceSlide = !!slides[0]?.isChoiceSlide;
  const dotSlides = hasChoiceSlide ? slides.slice(1) : slides;
  const dotOffset = hasChoiceSlide ? 1 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 pb-4">
          <DialogHeader>
            {!isChoiceSlide && (
              <div className="flex items-center gap-2 mb-5">
                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-xs">
                  {currentSlide - dotOffset + 1} / {dotSlides.length}
                </Badge>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                {Icon && (
                  <div className="p-3 rounded-xl bg-rose-50 w-fit mb-4">
                    <Icon className="w-7 h-7 text-rose-500" />
                  </div>
                )}

                <DialogTitle className="text-xl font-bold text-gray-900 mb-3 leading-snug">
                  {slide.title}
                </DialogTitle>

                <p className="text-sm text-gray-600 leading-relaxed">
                  {slide.description}
                </p>

                {slide.highlight && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-100">
                    <p className="text-sm text-rose-700 font-medium leading-relaxed">
                      {slide.highlight}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </DialogHeader>

          {/* Dots — hidden on choice slide */}
          {!isChoiceSlide && (
            <div className="flex justify-center gap-1.5 mt-6">
              {dotSlides.map((_, relIdx) => {
                const actualIdx = relIdx + dotOffset;
                return (
                  <button
                    key={relIdx}
                    onClick={() => setCurrentSlide(actualIdx)}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      actualIdx === currentSlide
                        ? 'w-5 bg-rose-500'
                        : actualIdx < currentSlide
                        ? 'w-1.5 bg-rose-300'
                        : 'w-1.5 bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center gap-2">
          {isChoiceSlide ? (
            <>
              <span className="text-sm text-gray-500 mr-auto">Deseja ver o tour em cada página?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleIconsChoice(false, tourId)}
                className="h-8 px-4"
              >
                Não
              </Button>
              <Button
                size="sm"
                onClick={() => handleIconsChoice(true, tourId)}
                className="bg-rose-500 hover:bg-rose-600 h-8 px-4"
              >
                Sim
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleDontShowAgain(tourId)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors mr-auto"
              >
                Não mostrar novamente
              </button>

              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentSlide(s => s - 1)}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
              )}

              {!isLast ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentSlide(s => s + 1)}
                  className="bg-rose-500 hover:bg-rose-600 h-8 px-4"
                >
                  Próximo
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="bg-rose-500 hover:bg-rose-600 h-8 px-4"
                >
                  Fechar
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
