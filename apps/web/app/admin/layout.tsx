import { notFound } from 'next/navigation';

// Console admin temporairement désactivée
export default function AdminLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  notFound();
}
