export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600">Branding and integrations (placeholders)</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold">Branding</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Logo</label>
              <input className="input" placeholder="Upload mock" />
            </div>
            <div>
              <label className="label">Primary Color</label>
              <input className="input" type="color" defaultValue="#4f46e5" />
            </div>
            <button className="btn-primary btn-md">Save</button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Integrations</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Email Provider</label>
              <select className="input">
                <option>Mock</option>
              </select>
            </div>
            <div>
              <label className="label">Twilio</label>
              <input className="input" placeholder="Account SID (mock)" />
            </div>
            <div>
              <label className="label">Calendly</label>
              <input className="input" placeholder="Webhook key (mock)" />
            </div>
            <button className="btn-primary btn-md">Connect</button>
          </div>
        </div>
      </div>
    </div>
  );
}


