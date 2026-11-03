'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';

// Monaco and the WebSocket need the browser, so the whole room renders client-only.
const RoomView = dynamic(() => import('@/components/RoomView'), {
  ssr: false,
  loading: () => <RoomLoading />
});

function RoomLoading() {
  return (
    <div className="flex h-dvh items-center justify-center text-sm text-muted" role="status">
      Opening the room…
    </div>
  );
}

function Room() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = decodeURIComponent(String(params?.roomId || ''));
  const userName = (search.get('userName') || '').trim();
  return <RoomView roomId={roomId} userName={userName} />;
}

export default function RoomPage() {
  return (
    <Suspense fallback={<RoomLoading />}>
      <Room />
    </Suspense>
  );
}