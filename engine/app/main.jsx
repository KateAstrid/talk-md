import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Deck } from "./Deck.jsx";
import { NotesPage } from "./Notes.jsx";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
if (params.has("thumb")) document.documentElement.classList.add("is-still");

createRoot(document.getElementById("root")).render(
  <StrictMode>{params.has("notes") ? <NotesPage /> : <Deck />}</StrictMode>,
);
