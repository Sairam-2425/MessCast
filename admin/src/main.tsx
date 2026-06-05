import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';
import { theme } from './theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
        <ToastContainer
          position="bottom-right"
          theme="dark"
          toastStyle={{ backgroundColor: '#13131F', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
