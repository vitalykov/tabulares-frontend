// Simple sign in form
import React, { useState } from "react";
import { apiAuth, LoginResponse } from "../../../api";

export const SignInForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await apiAuth.register(email, password);
      alert(`User ID is: ${res.user_id}`);
    }
    catch (e) {
      alert(`Failed to sign up: ${(e as Error).message}`)
      return;
    }
    alert(`User signed up: ${email}`)
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Email
        <input
          type="login"
          id="login"
          name="login"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>Password</label>
      <input
        type="password"
        id="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Sign in</button>
    </form>
  );
};
