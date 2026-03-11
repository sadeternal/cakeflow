import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TourContext = createContext(null);

const ICONS_PREF_KEY = 'cakeflow_tour_icons_enabled';

export function TourProvider({ children }) {
  const [activeTour, setActiveTour] = useState(null);
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [iconsEnabled, setIconsEnabled] = useState(() => {
    return localStorage.getItem(ICONS_PREF_KEY) !== 'false';
  });

  const registerTour = useCallback((tourId, slides) => {
    const STORAGE_KEY = `cakeflow_tour_${tourId}_visto`;
    setActiveTour({ tourId, slides });
    setCurrentSlide(0);
    const iconsEnabledNow = localStorage.getItem(ICONS_PREF_KEY) !== 'false';
    if (iconsEnabledNow && localStorage.getItem(STORAGE_KEY) !== 'true') {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, []);

  const openTour = useCallback(() => {
    setCurrentSlide(0);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setCurrentSlide(0);
  }, []);

  const handleDontShowAgain = useCallback((tourId) => {
    if (tourId) {
      localStorage.setItem(`cakeflow_tour_${tourId}_visto`, 'true');
    }
    setOpen(false);
    setCurrentSlide(0);
  }, []);

  // Called when user answers the choice slide (Sim/Não)
  const handleIconsChoice = useCallback((enabled, tourId) => {
    localStorage.setItem(ICONS_PREF_KEY, enabled ? 'true' : 'false');
    setIconsEnabled(enabled);
    if (!enabled) {
      if (tourId) localStorage.setItem(`cakeflow_tour_${tourId}_visto`, 'true');
      setOpen(false);
      setCurrentSlide(0);
    } else {
      // Advance past the choice slide
      setCurrentSlide(1);
    }
  }, []);

  return (
    <TourContext.Provider value={{
      activeTour,
      open,
      setOpen,
      currentSlide,
      setCurrentSlide,
      iconsEnabled,
      registerTour,
      openTour,
      handleClose,
      handleDontShowAgain,
      handleIconsChoice,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}

export function useRegisterTour(tourId, slides, enabled = true) {
  const { registerTour } = useTour();
  useEffect(() => {
    if (enabled && tourId && slides?.length) {
      registerTour(tourId, slides);
    }
  }, [tourId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
