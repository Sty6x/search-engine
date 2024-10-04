import pubsub from "../../utils/pubsub.js";
import uuid from "../../utils/uuid.js";

const template = document.getElementById("crawl-input-template");
const listContainer = document.querySelector(".list-container");

/* File for handling the input entries for creating new crawl entries
 * of url for crawler to work with.
 *
 */
function createComponent(url) {
  const newId = uuid();
  const container = document.createElement("div");
  container.append(template.content.cloneNode(true));
  const btns = container.querySelectorAll("button");
  btns.forEach((btn) => btn.setAttribute("data-contref", newId));
  container.classList.add("url-entry");
  container.classList.add("reveal-entry");
  container.setAttribute("id", newId);
  console.log(container);

  const input = container.querySelector("input");
  input.value = url;
  return container;
}

function addNewEntry() {
  listContainer.appendChild(createComponent());
  pubsub.publish("addEntry", listContainer.children);
}

function hideEntry(ref) {
  const entries = Array.from(listContainer.children);
  const updatedEntries = entries.map((child) => {
    if (child.id === ref) {
      child.classList.replace("reveal-entry", "hide-entry");
      child.dataset.hidden = true;

      const input = child.querySelector("input");
      input.disabled = true;
      input.setAttribute("data-hidden", "true");
      return child;
    }
    return child;
  });
  pubsub.publish("hideEntry", updatedEntries);
}
function revealEntry(ref) {
  const entries = Array.from(listContainer.children);
  const updatedEntries = entries.map((child) => {
    if (child.id === ref) {
      child.classList.replace("hide-entry", "reveal-entry");
      child.dataset.hidden = false;

      const input = child.querySelector("input");
      input.disabled = false;
      input.setAttribute("data-hidden", "false");
      return child;
    }
    return child;
  });
  pubsub.publish("revealEntry", updatedEntries);
}

/*
  Params `ref` reference to the input we want to remove from the
  crawl list.
 */
function removeEntry(ref) {
  const entries = Array.from(listContainer.children);
  console.log(entries.length);
  if (entries.length < 2) {
    return;
  }
  const filtered = entries.filter((child) => child.id !== ref ?? child);
  pubsub.publish("removeEntry", filtered);
}

/*
  Params`newEntries` refers to the updated entries for deleting through pubsub
*/
function updateEntries(newEntries) {
  if (newEntries !== null) {
    listContainer.replaceChildren(...newEntries);
  }
  console.log(listContainer);
}

function submitCrawlList() {}

export default {
  createComponent,
  addNewEntry,
  removeEntry,
  updateEntries,
  revealEntry,
  hideEntry,
  submitCrawlList,
};
