import { Suspense } from 'react';
import InputDemo from './InputDemo';

export default function Home() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-6 flex items-center justify-center h-[600px]">Loading...</div>}>
      <InputDemo />
    </Suspense>
  );
}
