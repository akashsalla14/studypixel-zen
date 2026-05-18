import './globals.css'
import './workspace.css'

export const metadata = {
  title: 'StudyPixel',
  description: 'Complete Adaptive Learning Operating System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}