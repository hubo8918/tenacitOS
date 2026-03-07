'use client';

import dynamic from 'next/dynamic';

const Office3D = dynamic(() => import('@/components/Office3D/Office3D'), { ssr: false });

export default function OfficeClient() {
  return <Office3D />;
}
