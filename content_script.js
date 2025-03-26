console.log("Twitter Tagger script loaded (v1.2 - Edit/Notes Modal).");

const STORAGE_KEY = 'twitterTaggerData';
const TAGGED_ATTRIBUTE = 'data-twitter-tagger-tagged';
const BUTTON_ADDED_ATTRIBUTE = 'data-twitter-tagger-button-added';
const MODAL_ID = 'twitter-tagger-modal';

// --- Storage Functions (Modified for 'notes') ---

async function getStoredTags() {
    try {
        const result = await browser.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] || {};
    } catch (error) {
        console.error("Error retrieving tags:", error);
        return {};
    }
}

async function saveTags(tags) {
    try {
        await browser.storage.local.set({ [STORAGE_KEY]: tags });
    } catch (error) {
        console.error("Error saving tags:", error);
    }
}

// Renamed: Handles both adding and updating, now includes notes
async function saveTagData(handle, tag, color, tweetUrl, notes = "") {
    const tags = await getStoredTags();
    const handleLower = handle.toLowerCase();

    // If it's a new tag, use provided url, otherwise keep existing url unless updating from initial prompt
    const existingUrl = tags[handleLower]?.url;
    const finalUrl = existingUrl && tweetUrl === null ? existingUrl : tweetUrl; // Allow null url only if updating

    tags[handleLower] = {
        tag,
        color,
        url: finalUrl, // Store the originating URL
        notes: notes // Store additional notes
    };
    await saveTags(tags);
    console.log(`Saved tag data for ${handle}`);
    // Don't automatically call applyTagsToPage here, let the calling function handle UI updates
}

// New: Function to delete a tag
async function deleteTag(handle) {
    const tags = await getStoredTags();
    const handleLower = handle.toLowerCase();
    if (tags[handleLower]) {
        delete tags[handleLower];
        await saveTags(tags);
        console.log(`Deleted tag for ${handle}`);
        return true; // Indicate success
    }
    return false; // Indicate tag didn't exist
}

// --- UI Functions ---

const TAG_COLORS = {
    '🔴 Red (Negative)': '#ffdddd',
    '🟠 Orange (Warning)': '#ffeacc',
    '🟡 Yellow (Neutral)': '#ffffcc',
    '🟢 Green (Positive)': '#ddffdd',
    '🔵 Blue (Info)': '#ddeeff',
    '🟣 Purple (Misc)': '#eeddff'
};

// --- Modal Creation and Handling (MODIFIED to avoid innerHTML) ---

function removeEditModal() {
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) {
        existingModal.remove();
    }
    // removeEventListener for outside click if you added it
}

function createEditModal(handle, tagData, tagElement) {
    removeEditModal(); // Ensure only one modal is open

    const modal = document.createElement('div');
    modal.id = MODAL_ID;

    // --- Build Modal using DOM methods ---

    // Title
    const title = document.createElement('h4');
    title.textContent = `Edit Tag for ${handle}`;
    modal.appendChild(title);

    // Tag Label and Input
    const tagLabel = document.createElement('label');
    tagLabel.setAttribute('for', 'tagger-tag-text');
    tagLabel.textContent = 'Tag:';
    modal.appendChild(tagLabel);

    const tagInput = document.createElement('input');
    tagInput.setAttribute('type', 'text');
    tagInput.id = 'tagger-tag-text';
    tagInput.value = tagData.tag;
    modal.appendChild(tagInput);

    // Color Label and Select
    const colorLabel = document.createElement('label');
    colorLabel.setAttribute('for', 'tagger-tag-color');
    colorLabel.textContent = 'Color:';
    modal.appendChild(colorLabel);

    const colorSelect = document.createElement('select');
    colorSelect.id = 'tagger-tag-color';
    for (const [name, hex] of Object.entries(TAG_COLORS)) {
        const option = document.createElement('option');
        option.value = hex;
        option.textContent = name;
        if (tagData.color === hex) {
            option.selected = true;
        }
        colorSelect.appendChild(option);
    }
    modal.appendChild(colorSelect);

    // Notes Label and Textarea
    const notesLabel = document.createElement('label');
    notesLabel.setAttribute('for', 'tagger-tag-notes');
    notesLabel.textContent = 'Notes:';
    modal.appendChild(notesLabel);

    const notesTextarea = document.createElement('textarea');
    notesTextarea.id = 'tagger-tag-notes';
    notesTextarea.textContent = tagData.notes || ''; // Use textContent for textarea value
    modal.appendChild(notesTextarea);

    // Actions Container
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    modal.appendChild(actionsDiv);

    // Save Button
    const saveButton = document.createElement('button');
    saveButton.className = 'save';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', async () => {
        const newTag = tagInput.value.trim();
        const newColor = colorSelect.value;
        const newNotes = notesTextarea.value; // Read from textarea

        if (newTag) {
            await saveTagData(handle, newTag, newColor, null, newNotes); // Pass null URL to keep original
            removeEditModal();
            applyTagsToPage(); // Re-scan to update UI
        } else {
            alert("Tag text cannot be empty.");
        }
    });
    actionsDiv.appendChild(saveButton);

    // Go to Source Button
    const sourceButton = document.createElement('button');
    sourceButton.className = 'source';
    sourceButton.textContent = 'Go to Source';
    sourceButton.addEventListener('click', () => {
        if (tagData.url) {
            window.open(tagData.url, '_blank');
        } else {
            alert("No source URL recorded for this tag.");
        }
    });
    actionsDiv.appendChild(sourceButton);

    // Delete Button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete';
    deleteButton.textContent = 'Delete Tag';
    deleteButton.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the tag for ${handle}?`)) {
            const deleted = await deleteTag(handle);
            removeEditModal();
            if (deleted) {
                applyTagsToPage(); // Re-scan to update UI
            }
        }
    });
    actionsDiv.appendChild(deleteButton);

    // Close Button
    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', removeEditModal);
    actionsDiv.appendChild(closeButton);

    // --- End Modal Build ---

    document.body.appendChild(modal);

    // Position calculation (same as before)
    const rect = tagElement.getBoundingClientRect();
    modal.style.position = 'absolute'; // Use absolute for positioning relative to scroll
    modal.style.top = `${window.scrollY + rect.bottom + 5}px`;
    modal.style.left = `${window.scrollX + rect.left}px`;

    // Adjust position if it overflows viewport (simple check - same as before)
    const modalRect = modal.getBoundingClientRect();
    if (modalRect.bottom > window.innerHeight) {
        modal.style.top = `${window.scrollY + rect.top - modalRect.height - 5}px`; // Position above
    }
    if (modalRect.right > window.innerWidth) {
         modal.style.left = `${window.scrollX + rect.right - modalRect.width}px`; // Align right
    }

     // Optional: Add outside click listener if needed (same code as before)
}

// Modified: Creates the clickable tag SPAN
function createTagElement(handle, tagData) { // Now needs handle too
    const tagElement = document.createElement('span'); // Use SPAN instead of A
    tagElement.textContent = ` [${tagData.tag}]`;
    tagElement.className = 'twitter-tagger-tag';
    tagElement.style.backgroundColor = tagData.color;
    tagElement.title = `Click to edit/view notes for ${handle}`;
    tagElement.style.cursor = 'pointer';

    // Store data with the element for easy access in modal
    // This is a simple way; could also use data-* attributes
    tagElement.tagData = tagData;
    tagElement.handle = handle;


    tagElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        createEditModal(handle, tagElement.tagData, tagElement); // Pass element for positioning
         // If using outside click removal:
         // setTimeout(() => document.addEventListener('click', handleClickOutside, true), 0); // Add listener after current event bubbles up
    });
    return tagElement;
}

// Initial tag creation prompt (Unchanged conceptually, but uses saveTagData)
function promptForTag(handle, tweetUrl) {
    const tagText = prompt(`Enter a short tag for ${handle}:`);
    if (tagText === null || tagText.trim() === "") {
        console.log("Tagging cancelled.");
        return;
    }

    const colorOptions = Object.keys(TAG_COLORS);
    const colorChoice = prompt(`Choose a color category for ${handle}:\n\n${colorOptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);

    if (colorChoice === null) {
        console.log("Tagging cancelled.");
        return;
    }

    const colorIndex = parseInt(colorChoice, 10) - 1;
    if (isNaN(colorIndex) || colorIndex < 0 || colorIndex >= colorOptions.length) {
        alert("Invalid color choice.");
        return;
    }

    const selectedColorName = colorOptions[colorIndex];
    const selectedColorHex = TAG_COLORS[selectedColorName];

    // Use saveTagData, initial notes are empty ""
    saveTagData(handle, tagText.trim(), selectedColorHex, tweetUrl, "").then(() => {
         applyTagsToPage(); // Re-scan AFTER saving to update UI
    });
}


// Tag Button creation (Unchanged)
function createTagButton(handle, tweetUrl) {
    const button = document.createElement('button');
    button.textContent = '🏷️';
    button.title = `Tag user ${handle}`;
    button.className = 'twitter-tagger-button';
    button.style.marginLeft = '4px'; // ... other styles
    button.style.verticalAlign = 'middle';
    // ... rest of styles from previous version ...
    button.style.border = '1px solid #ccc';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '10px';
    button.style.padding = '1px 3px';
    button.style.backgroundColor = '#eee';

    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        promptForTag(handle, tweetUrl);
    });
    return button;
}


// --- Core Logic (MODIFIED - Button visibility logic) ---

async function applyTagsToPage() {
    const storedTags = await getStoredTags();
    const processedElements = new Set(); // Keep track of elements processed in this run

    // --- 1. Remove Old Tags/Buttons before applying new ones ---
    // This helps clean up if elements are somehow duplicated or selectors change
    document.querySelectorAll('.twitter-tagger-tag, .twitter-tagger-button').forEach(el => el.remove());

    // --- 2. Apply Tags to Specific Username Locations ---
    const profileHandleSelector = 'div[data-testid="UserProfileHeader_Items"] a[href*="/"][role="link"][dir="ltr"]';
    const tweetHandleSelector = 'article[data-testid="tweet"] div[data-testid="User-Name"] a[href*="/"][role="link"][dir="ltr"]';
    const targetSelectors = `${profileHandleSelector}, ${tweetHandleSelector}`;
    const potentialTagLocations = document.querySelectorAll(targetSelectors);

    potentialTagLocations.forEach(linkElement => {
        if (processedElements.has(linkElement)) return; // Skip if already processed

        const href = linkElement.getAttribute('href');
        const match = href.match(/^\/([a-zA-Z0-9_]+)(?:\/|$)/);
        if (!match) return;

        const handle = `@${match[1]}`;
        const handleLower = handle.toLowerCase();

        // Check if a tag EXISTS for this user
        if (storedTags[handleLower]) {
            const tagData = storedTags[handleLower];
            // Check if tag not already added *after* this element in this run
            if (!linkElement.nextElementSibling?.classList.contains('twitter-tagger-tag')) {
                 const tagElement = createTagElement(handle, tagData); // Pass handle
                 linkElement.insertAdjacentElement('afterend', tagElement);
                 processedElements.add(linkElement); // Mark as processed
            }
        }
    });

    // --- 3. Add Tag Buttons (Only if NO tag exists AND in Tweets) ---
    const potentialButtonLocations = document.querySelectorAll(tweetHandleSelector);

    potentialButtonLocations.forEach(userNameLink => {
        if (processedElements.has(userNameLink)) return; // Skip if tag was added

        const href = userNameLink.getAttribute('href');
        const match = href.match(/^\/([a-zA-Z0-9_]+)(?:\/|$)/);
        if (!match) return;

        const handle = `@${match[1]}`;
        const handleLower = handle.toLowerCase();

        // *** CRITICAL CHANGE: Only add button if NO tag exists for this user ***
        if (!storedTags[handleLower]) {
            // And ensure button isn't already added after this element
             if (!userNameLink.nextElementSibling?.classList.contains('twitter-tagger-button')) {
                const tweetArticle = userNameLink.closest('article[data-testid="tweet"]');
                if (tweetArticle) {
                    const timeElement = tweetArticle.querySelector('a time');
                    const tweetLinkElement = timeElement?.closest('a');
                    const tweetUrl = tweetLinkElement?.href;

                    if (tweetUrl) {
                        const tagButton = createTagButton(handle, tweetUrl);
                        userNameLink.insertAdjacentElement('afterend', tagButton);
                        processedElements.add(userNameLink); // Mark as processed
                    }
                }
            }
        }
         // else: A tag exists, so DO NOTHING (don't add the button)
    });
}


// --- Mutation Observer (Slightly adjusted strategy) ---

// Debounce function to limit rapid calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Use debounced version of applyTagsToPage for the observer
const debouncedApplyTags = debounce(applyTagsToPage, 500); // Increased delay

const mutationCallback = (mutationsList, observer) => {
    // Simple check: if any nodes were added/removed, trigger a debounced refresh
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
             // Check if added/removed nodes might be relevant (optional optimization)
             let relevantChange = false;
             const checkNodes = [...mutation.addedNodes, ...mutation.removedNodes];
             for(const node of checkNodes) {
                 if (node.nodeType === Node.ELEMENT_NODE) {
                     if (node.matches('article, [data-testid*="User"]') || node.querySelector('article, [data-testid*="User"]')) {
                         relevantChange = true;
                         break;
                     }
                 }
             }
             if (relevantChange) {
                debouncedApplyTags();
                return; // Only need to trigger once per batch of mutations
             }
        }
    }
};

const observer = new MutationObserver(mutationCallback);

function startObserver() {
    // Target the main timeline area if possible, more specific than 'main' sometimes
    const targetNode = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main') || document.body;
    if (targetNode) {
        const config = { childList: true, subtree: true };
        observer.observe(targetNode, config);
        console.log("Mutation observer started on:", targetNode);
    } else {
        setTimeout(startObserver, 500);
        console.log("Waiting for target node...");
    }
}

// --- Initial Run ---
// Ensure modal is removed on script load/reload
removeEditModal();
// Apply tags/buttons initially
applyTagsToPage();
// Start observing
startObserver();