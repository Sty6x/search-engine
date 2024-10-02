import navigation from "./client_navigation/navigation.js";
import crawlInput from "./components/crawl_input/index.js";
import ui from "./ui/index.js";
import pubsub from "./utils/pubsub.js";

const sidebar = document.getElementById("crawl-list-sb");
const newEntry = document.querySelector(".new-entry-btn");
const closeSbBtn = document.getElementById("close-sb");
const openSbBtn = document.getElementById("add-entry-sb-btn");
const listContainer = document.querySelector(".list-container");
const limit = 6;
const popup = document.createElement("p");
popup.classList.add("info-large");

window.addEventListener("load", () => {
  ui.init();
  navigation.showPage("/");
});

openSbBtn.addEventListener("click", () => {
  sidebar.classList.replace("inactive-sb", "active-sb");
});

sidebar.addEventListener("click", ui.sidebarActions);
pubsub.subscribe("removeEntry", crawlInput.updateEntries);
pubsub.subscribe("removeEntry", (entries) => {
  if (entries.length === 0) {
    listContainer.innerHTML = `<p class='info-large'>Seems like you don't have any entries yet, click on "New entry".</p>`;
  }
  if (entries.length <= limit) {
    newEntry.disabled = false;
    const children = Array.from(listContainer.children);
    children.forEach((child) => {
      if (child.classList.contains("info-large")) {
        child.remove();
      }
    });
  }
});
pubsub.subscribe("addEntry", (entries) => {
  popup.textContent = "You've reached the maximum limit.";
  if (entries.length >= limit) {
    console.log("lol");
    listContainer.appendChild(popup);
    newEntry.disabled = true;
  }
});
pubsub.subscribe("hideEntry", crawlInput.updateEntries);
