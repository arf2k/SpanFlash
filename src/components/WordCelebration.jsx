import React, { useState, useEffect } from 'react';

const WordCelebration = ({ 
  isVisible, 
  celebrationType, 
  onAnimationComplete 
}) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsActive(true);
      // Auto-hide after animation completes
      const timer = setTimeout(() => {
        setIsActive(false);
        onAnimationComplete?.();
      }, 2000); // Match CSS animation duration

      return () => clearTimeout(timer);
    }
  }, [isVisible, onAnimationComplete]);

  if (!isActive || !celebrationType) return null;

  const getMilestoneText = (type) => {
    switch (type) {
      case 'learning':
        return '🌱 Learning!';
      case 'familiar':
        return '📚 Familiar!';
      case 'mastered':
        return '⭐ Mastered!';
      default:
        return '🎉 Progress!';
    }
  };

  return (
    <div className={`milestone-flash milestone-flash--${celebrationType}`}>
      {getMilestoneText(celebrationType)}
    </div>
  );
};

export default WordCelebration;