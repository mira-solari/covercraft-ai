export default function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">⚡</span>
            </div>
            <span className="text-sm font-semibold">
              Apply<span className="gradient-text">Faster</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-300 transition">
              Terms
            </a>
            <a href="mailto:support@applyfaster.ai" className="hover:text-gray-300 transition">
              Contact
            </a>
          </div>

          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} ApplyFaster. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
