Environment configuration for messaging and voicemail integrations

Required variables by provider. Do not duplicate existing keys in .env; use these exact keys if you enable the associated provider.

SMS (Bonzo)
- SMS_PROVIDER=bonzo
- BONZO_API_BASE_URL= https://api.getbonzo.com (example; confirm from Bonzo docs)
- BONZO_API_KEY= <server_api_key>
- BONZO_FROM_NUMBER= +1XXXXXXXXXX (optional, if Bonzo requires from)
- BONZO_SEND_PATH= /messages/send (optional override if endpoint path differs)

SMS (Twilio fallback)
- TWILIO_ACCOUNT_SID=
- TWILIO_AUTH_TOKEN=
- TWILIO_FROM_NUMBER= +1XXXXXXXXXX (or)
- TWILIO_MESSAGING_SERVICE_SID=

Voicemail Drops (Slybroadcast)
- VOICEMAIL_PROVIDER=slybroadcast
- SLYBROADCAST_API_BASE_URL=https://www.slybroadcast.com/gateway/vmb.php
- SLYBROADCAST_USERNAME= <account email/username>
- SLYBROADCAST_PASSWORD= <api password>
- SLYBROADCAST_DEFAULT_AUDIO_URL= https://.../your.mp3 (optional default media)
// Public base URL of the server used to construct temporary media links for TTS
- PUBLIC_BASE_URL= https://your-server.onrender.com

Text-to-Speech (ElevenLabs)
- ELEVENLABS_API_KEY=
- ELEVENLABS_VOICE_ID=
- ELEVENLABS_MODEL_ID= eleven_multilingual_v2 (optional)
- ELEVENLABS_API_BASE_URL= https://api.elevenlabs.io/v1 (optional)

Notes
- If SMS_PROVIDER is not set or Bonzo creds are missing, the system will attempt Twilio if Twilio envs are present; otherwise it will simulate locally and still log messages to conversations.
- The /api/voicemail/drop endpoint accepts either audioUrl or ttsScript. With ttsScript, the server will request an mp3 from ElevenLabs and pass it to Slybroadcast. In this scaffold, the mp3 is returned as a data URL; use S3/GCS in production.
- Webhook endpoints available:
  - /api/twilio/inbound-sms (POST form-url-encoded)
  - /api/bonzo/inbound-sms (POST JSON/form)


