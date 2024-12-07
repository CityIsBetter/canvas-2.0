"use client"
import React from 'react';
import dynamic from 'next/dynamic'

const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false // This disables server-side rendering for this component
})

export default function SketchPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-4xl">
        <Canvas />
      </div>
    </div>
  );
}