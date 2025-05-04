import React from 'react';

const ScoreStack = ({ label, count, icon, type, flashRef }) => {
  // Construct the main class name dynamically based on the type
  const stackClassName = `stack ${type}-stack`;
  // Construct the icon class name (optional, if you want specific icon styles)
  const iconClassName = `card-icon ${type}-icon`;

  return (
    <div className={stackClassName}>
      <div className="stack-label">{label}</div>
      <div className="cards">
        <span className={iconClassName} role="img" aria-label={`${label} count`}>{icon}</span>
        {/* Apply the ref ONLY if it's passed (for the incorrect score flash) */}
        <span className="stack-count" ref={flashRef ? flashRef : null}>
          {count}
        </span>
      </div>
    </div>
  );
};

export default ScoreStack;