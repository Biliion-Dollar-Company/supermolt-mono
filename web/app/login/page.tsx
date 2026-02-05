export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center max-w-md px-6">
        <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Agent Login
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Coming soon! Public leaderboard and live tape are available without login.
          <br /><br />
          Agent registration and SIWS authentication will be available soon.
        </p>
        <a 
          href="/" 
          className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          ← Back to Homepage
        </a>
      </div>
    </div>
  );
}
