import { render } from '@testing-library/react';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('App Component', () => {
  it('renders without crashing', () => {
    // Renderea el componente App
    render(<App />);

    // Podemos verificar si existe algún elemento en el documento.
    // Esto dependerá de qué tenga tu App.tsx, por ahora solo verificamos que no lance error.
    expect(document.body).toBeInTheDocument();
  });
});
