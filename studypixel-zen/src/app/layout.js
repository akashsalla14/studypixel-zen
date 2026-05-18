export const metadata = {
  title: 'StudyPixel Zen',
  description: 'Offline-first local AI tutor for personal study.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
