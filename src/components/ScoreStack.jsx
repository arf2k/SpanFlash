import React from 'react';

// Added 'onClick' to the destructured props
const ScoreStack = ({ label, count, icon, type, flashRef, onClick }) => {
  // Construct class names based on the 'type' prop
  const stackClassName = `stack ${type}-stack`;
  const iconClassName = `card-icon ${type}-icon`; // Keep this if you add type-specific icon styles

  return (

    // If no onClick is passed (like for Correct/Incorrect), it will be undefined and do nothing.
    <div className={stackClassName} onClick={onClick}>
      <div className="stack-label">{label}</div>
      <div className="cards">
        <span className={iconClassName} role="img" aria-label={`${label} count`}>
            {icon}
        </span>
        {/* Apply the ref only if provided (for incorrect score flash) */}
        <span className="stack-count" ref={flashRef || null}>
          {count}
        </span>
      </div>
    </div>
  );
};

export default ScoreStack;