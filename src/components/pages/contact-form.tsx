"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setStatus(response.ok ? "Thanks. Your message was saved." : "Could not save feedback yet.");
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input name="name" className="input-shell w-full" placeholder="Name" required />
      <input name="email" type="email" className="input-shell w-full" placeholder="Email" required />
      <select name="category" className="input-shell w-full" defaultValue="feedback">
        <option value="feedback">Feedback</option>
        <option value="bug">Bug report</option>
        <option value="feature">Feature request</option>
        <option value="contact">Contact</option>
      </select>
      <textarea
        name="message"
        className="min-h-32 w-full resize-none rounded-2xl bg-[#f2f2f7] px-4 py-3 text-sm font-semibold outline-none"
        placeholder="What should we know?"
        required
      />
      {status && <p className="text-sm font-bold text-[#007aff]">{status}</p>}
      <button className="h-12 w-full rounded-full bg-[#007aff] text-base font-bold text-white">
        Send feedback
      </button>
    </form>
  );
}
