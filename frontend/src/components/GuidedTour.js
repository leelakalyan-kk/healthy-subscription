import React, { useState, useEffect } from 'react';

export default function GuidedTour({ tourKey, steps = [] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(`tour_completed_${tourKey}`);
    if (!hasSeenTour && steps.length > 0) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [tourKey, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`tour_completed_${tourKey}`, 'true');
    setIsVisible(false);
  };

  if (!isVisible || steps.length === 0) return null;

  const step = steps[currentStep];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(3px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '420px',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid #e2e8f0',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#16a34a',
            background: '#ecfdf5',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid #86efac'
          }}>
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={handleComplete}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Skip Tour
          </button>
        </div>

        <div style={{ fontSize: '36px', marginBottom: '10px' }}>{step.icon || '🚀'}</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{step.title}</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>{step.desc}</p>

        <div style={{ display: 'flex', gap: '10px' }}>
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: '8px',
              background: '#16a34a',
              border: 'none',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {currentStep === steps.length - 1 ? '🎉 Get Started!' : 'Next ➔'}
          </button>
        </div>
      </div>
    </div>
  );
}
