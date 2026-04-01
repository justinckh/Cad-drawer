import ExerciseOne from './components/ExerciseOne.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="2" y="14" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2"/>
              <line x1="6" y1="10" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2,2"/>
            </svg>
            CAD Projection Trainer
          </div>
          <div className="app-badge">Exercise 1 of 1</div>
        </div>
      </header>
      <main className="app-main">
        <ExerciseOne />
      </main>
    </div>
  );
}
