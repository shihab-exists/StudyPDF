import React, { Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { ToastProvider } from './components/Toasts';
import ProgressBar from './components/ProgressBar';
import Home from './pages/Home';
import Tools from './pages/Tools';
import MyFiles from './pages/MyFiles';
import About from './pages/About';
import NotFound from './pages/NotFound';

// Tool pages are lazy-loaded so the first paint stays light.
const Compress = React.lazy(() => import('./pages/Compress'));
const Merge = React.lazy(() => import('./pages/Merge'));
const Split = React.lazy(() => import('./pages/Split'));
const PageManager = React.lazy(() => import('./pages/PageManager'));
const RotateAll = React.lazy(() => import('./pages/RotateAll'));
const Numbers = React.lazy(() => import('./pages/Numbers'));
const Watermark = React.lazy(() => import('./pages/Watermark'));
const Protect = React.lazy(() => import('./pages/Protect'));
const ToImages = React.lazy(() => import('./pages/ToImages'));
const FromImages = React.lazy(() => import('./pages/FromImages'));
const ToWord = React.lazy(() => import('./pages/ToWord'));
const ToPptx = React.lazy(() => import('./pages/ToPptx'));
const ToExcel = React.lazy(() => import('./pages/ToExcel'));
const Ocr = React.lazy(() => import('./pages/Ocr'));
const ExtractText = React.lazy(() => import('./pages/ExtractText'));
const PdfInfo = React.lazy(() => import('./pages/PdfInfo'));

function PageFallback() {
  return (
    <div className="paper torn-sheet rounded-md max-w-3xl mx-auto p-10">
      <ProgressBar label="Opening the tool…" />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col relative overflow-x-clip">
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 pt-6 sm:pt-10 relative z-10">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/tools" element={<Tools />} />
                {/* organize */}
                <Route path="/compress" element={<Compress />} />
                <Route path="/merge" element={<Merge />} />
                <Route path="/split" element={<Split />} />
                <Route path="/pages" element={<PageManager />} />
                <Route path="/rotate" element={<RotateAll />} />
                {/* edit & customize */}
                <Route path="/numbers" element={<Numbers />} />
                <Route path="/watermark" element={<Watermark />} />
                <Route path="/protect" element={<Protect />} />
                {/* convert */}
                <Route path="/to-images" element={<ToImages />} />
                <Route path="/from-images" element={<FromImages />} />
                <Route path="/to-word" element={<ToWord />} />
                <Route path="/to-pptx" element={<ToPptx />} />
                <Route path="/to-excel" element={<ToExcel />} />
                {/* extract & inspect */}
                <Route path="/ocr" element={<Ocr />} />
                <Route path="/text" element={<ExtractText />} />
                <Route path="/info" element={<PdfInfo />} />
                <Route path="/my-files" element={<MyFiles />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
