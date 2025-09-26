import React from 'react';

// EMERGENCY SIMPLE APP TO BYPASS CRASHES
export default function EmergencyApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🚨 Emergency Mode - App Simplified</h1>
      <p>The app was crashing. This is a minimal version to diagnose issues.</p>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>Test Credentials:</h3>
        <ul>
          <li><strong>Super-admin:</strong> super@phantomglass.com / SuperAdmin123!</li>
          <li><strong>Admin:</strong> admin@phantomglass.com / Admin123!</li>
          <li><strong>User:</strong> user@phantomglass.com / User123!</li>
        </ul>
      </div>

      <form style={{ marginTop: '20px' }} onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        fetch('http://127.0.0.1:54321/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
          },
          body: JSON.stringify({ email, password })
        })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            alert('✅ Login successful! Token: ' + data.access_token.substring(0, 50) + '...');
          } else {
            alert('❌ Login failed: ' + JSON.stringify(data));
          }
        })
        .catch(err => alert('❌ Error: ' + err.message));
      }}>
        <h3>Emergency Login Test:</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            name="email"
            type="email"
            placeholder="Email"
            defaultValue="super@phantomglass.com"
            style={{ padding: '8px', marginRight: '10px', width: '200px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            name="password"
            type="password"
            placeholder="Password"
            defaultValue="SuperAdmin123!"
            style={{ padding: '8px', marginRight: '10px', width: '200px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
          Test Login
        </button>
      </form>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
        <h3>🔧 To fix the main app:</h3>
        <ol>
          <li>Backup the current App.tsx</li>
          <li>Temporarily replace with this emergency version</li>
          <li>Check browser console for actual errors</li>
          <li>Restore original App.tsx and fix the specific error</li>
        </ol>
      </div>
    </div>
  );
}