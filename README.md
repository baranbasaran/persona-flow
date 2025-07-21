# PersonaFlow 🤖✨

**PersonaFlow** is an AI-powered WhatsApp CRM Assistant that connects WhatsApp (via Twilio), HubSpot CRM, and Large Language Models (LLMs) to automate and personalize customer conversations. It introduces two major innovations:

1.  **Dynamic AI Personas:** Tailors the AI's response tone and style based on contact data stored in HubSpot.
2.  **Auto-Summarized Timelines:** Generates concise, AI-powered summaries of conversations and posts them as notes on the contact's timeline in HubSpot.

This project is built with a focus on best practices, including robust error handling, security, rate limiting, and a modular, scalable architecture.

---

## 🚀 Features

*   **WhatsApp 2-way Messaging:** Engage with customers directly on WhatsApp through the Twilio API.
*   **HubSpot CRM Integration:** Automatically match contacts, fetch data, and log conversation summaries.
*   **Dynamic AI Personas:** Create unique conversational experiences by adjusting the AI's persona based on CRM data.
*   **AI-Powered Replies:** Leverage LangChain and OpenAI to generate intelligent, context-aware responses.
*   **Auto-Summarized Timelines:** Keep your CRM up-to-date with AI-generated notes summarizing key conversation points.
*   **Secure & Robust:** Implements Twilio request validation, rate limiting, and exponential backoff for API calls.

---

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express, TypeScript
*   **Messaging:** Twilio WhatsApp API
*   **CRM:** HubSpot API
*   **Database:** MongoDB with Mongoose
*   **AI Orchestration:** LangChain.js
*   **LLM Provider:** OpenAI (GPT-3.5-Turbo and others)
*   **Development:** Nodemon for auto-reloading

---

## ⚙️ Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/PersonaFlow.git
    cd PersonaFlow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the necessary credentials. You can use the `.env.example` file as a template.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Expose your local server to the internet:**
    Use a tool like [ngrok](https://ngrok.com/) to create a public URL for your local server. This is necessary for Twilio's webhooks.
    ```bash
    ngrok http 3000
    ```

6.  **Configure Twilio Webhook:**
    In your Twilio console, set the webhook for your WhatsApp number to the ngrok URL, followed by `/twilio/webhook`. For example: `https://your-ngrok-url.ngrok.io/twilio/webhook`

---

## 📁 Project Structure

```
/src
├── /integrations
│   ├── /hubspot       # HubSpot client, contact utilities
│   ├── /langchain     # LangChain and OpenAI client
│   ├── /mongodb       # MongoDB connection and message model
│   └── /twilio        # Twilio client, webhook handler, and utilities
├── /routes            # Express routes
├── app.ts             # Express app setup
└── index.ts           # Server entry point
```

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details. 