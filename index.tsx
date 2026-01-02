/**
 * THESIS ARTIFACT: MAIN ENTRY POINT
 * 
 * This file is the "Bootstrapper" of the React Application.
 * It locates the 'root' div in the HTML and injects the entire secure application into it.
 * 
 * Academic Note: This follows the Single Page Application (SPA) architecture.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}