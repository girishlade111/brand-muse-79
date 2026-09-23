// Figma Plugin Controller: Brand Muse Token Synchronizer (Compiled).
figma.showUI(__html__, {
  width: 440,
  height: 640,
  themeColors: true,
  title: "Brand Muse · Token Sync",
});

const STORAGE_KEY_KIT_ID = "brandmuse_kit_id";
const STORAGE_KEY_TOKEN = "brandmuse_share_token";
const STORAGE_KEY_API_URL = "brandmuse_api_url";
const STORAGE_KEY_LAST_HASH = "brandmuse_last_hash";
const STORAGE_KEY_LAST_SYNC = "brandmuse_last_sync";

figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      case "init": {
        const kitId = (await figma.clientStorage.getAsync(STORAGE_KEY_KIT_ID)) || "";
        const shareToken = (await figma.clientStorage.getAsync(STORAGE_KEY_TOKEN)) || "";
        const apiUrl =
          (await figma.clientStorage.getAsync(STORAGE_KEY_API_URL)) ||
          "http://localhost:5173";
        const lastHash = (await figma.clientStorage.getAsync(STORAGE_KEY_LAST_HASH)) || null;
        const lastSync = (await figma.clientStorage.getAsync(STORAGE_KEY_LAST_SYNC)) || null;

        figma.ui.postMessage({
          type: "init-config",
          kitId,
          shareToken,
          apiUrl,
          lastHash,
          lastSync,
        });
        break;
      }

      case "save-config": {
        if (msg.kitId !== undefined) await figma.clientStorage.setAsync(STORAGE_KEY_KIT_ID, msg.kitId);
        if (msg.shareToken !== undefined) await figma.clientStorage.setAsync(STORAGE_KEY_TOKEN, msg.shareToken);
        if (msg.apiUrl !== undefined) await figma.clientStorage.setAsync(STORAGE_KEY_API_URL, msg.apiUrl);
        figma.notify("Configuration saved locally.");
        break;
      }

      case "sync-variables": {
        const payload = msg.payload;
        if (!payload || !payload.figmaVariables) {
          throw new Error("Invalid payload provided to sync-variables.");
        }

        const { collections, textStyles } = payload.figmaVariables;
        let variablesCreated = 0;
        let variablesUpdated = 0;
        let stylesCreated = 0;

        if (figma.variables && collections && Array.isArray(collections)) {
          const existingCollections =
            typeof figma.variables.getLocalVariableCollectionsAsync === "function"
              ? await figma.variables.getLocalVariableCollectionsAsync()
              : figma.variables.getLocalVariableCollections();

          const existingVariables =
            typeof figma.variables.getLocalVariablesAsync === "function"
              ? await figma.variables.getLocalVariablesAsync()
              : figma.variables.getLocalVariables();

          for (const colDef of collections) {
            let collection = existingCollections.find((c) => c.name === colDef.name);

            if (!collection) {
              collection = figma.variables.createVariableCollection(colDef.name);
            }

            const defaultModeId = collection.modes[0]?.modeId;

            for (const vDef of colDef.variables) {
              let variable = existingVariables.find(
                (v) => v.name === vDef.name && v.variableCollectionId === collection.id,
              );

              if (!variable) {
                variable = figma.variables.createVariable(vDef.name, collection, vDef.type);
                variablesCreated++;
              } else {
                variablesUpdated++;
              }

              if (vDef.description) {
                variable.description = vDef.description;
              }

              if (vDef.scopes && variable.scopes) {
                try {
                  variable.scopes = vDef.scopes;
                } catch (e) {}
              }

              const rawVal = vDef.valuesByMode?.Default;
              if (rawVal !== undefined && defaultModeId) {
                if (vDef.type === "COLOR") {
                  variable.setValueForMode(defaultModeId, rawVal);
                } else if (vDef.type === "FLOAT") {
                  variable.setValueForMode(defaultModeId, Number(rawVal));
                } else {
                  variable.setValueForMode(defaultModeId, rawVal);
                }
              }
            }
          }
        }

        if (textStyles && Array.isArray(textStyles)) {
          const existingStyles =
            typeof figma.getLocalTextStylesAsync === "function"
              ? await figma.getLocalTextStylesAsync()
              : figma.getLocalTextStyles();

          for (const sDef of textStyles) {
            let style = existingStyles.find((s) => s.name === sDef.name);
            if (!style) {
              style = figma.createTextStyle();
              style.name = sDef.name;
              stylesCreated++;
            }

            try {
              await figma.loadFontAsync({
                family: sDef.fontFamily,
                style: sDef.fontStyle || "Regular",
              });
              style.fontName = {
                family: sDef.fontFamily,
                style: sDef.fontStyle || "Regular",
              };
            } catch (e) {
              try {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
                style.fontName = { family: "Inter", style: "Regular" };
              } catch (e2) {}
            }

            style.fontSize = sDef.fontSize || 16;
            if (sDef.lineHeight) style.lineHeight = sDef.lineHeight;
            if (sDef.letterSpacing) style.letterSpacing = sDef.letterSpacing;
          }
        }

        const hash = msg.hash || payload.hash || "";
        const syncTimestamp = new Date().toISOString();
        if (hash) await figma.clientStorage.setAsync(STORAGE_KEY_LAST_HASH, hash);
        await figma.clientStorage.setAsync(STORAGE_KEY_LAST_SYNC, syncTimestamp);

        const summary = `Synced: ${variablesCreated} created, ${variablesUpdated} updated, ${stylesCreated} text styles.`;
        figma.notify(`✓ ${summary}`);

        figma.ui.postMessage({
          type: "sync-success",
          summary,
          hash,
          lastSync: syncTimestamp,
        });
        break;
      }

      case "insert-logos": {
        const logos = msg.logos || [];
        if (!logos.length) {
          figma.notify("No vector logo definitions found in payload.");
          return;
        }

        let insertedCount = 0;
        let offsetX = figma.viewport.center.x - 200;
        const offsetY = figma.viewport.center.y - 100;
        const createdNodes = [];

        for (const logo of logos) {
          if (logo.svg) {
            try {
              const node = figma.createNodeFromSvg(logo.svg);
              node.name = logo.name || `Logo - ${logo.kind}`;
              node.x = offsetX;
              node.y = offsetY;
              figma.currentPage.appendChild(node);
              createdNodes.push(node);
              offsetX += node.width + 48;
              insertedCount++;
            } catch (err) {
              console.warn("Failed to create SVG node:", err);
            }
          }
        }

        if (createdNodes.length > 0) {
          figma.currentPage.selection = createdNodes;
          figma.viewport.scrollAndZoomIntoView(createdNodes);
          figma.notify(`Placed ${insertedCount} logo variant(s) onto canvas.`);
        } else {
          figma.notify("Could not insert SVG nodes directly. Ensure SVG markup is available.");
        }

        figma.ui.postMessage({ type: "logos-inserted", count: insertedCount });
        break;
      }

      case "notify": {
        figma.notify(msg.text || "");
        break;
      }
    }
  } catch (err) {
    console.error("Plugin execution error:", err);
    figma.notify(`Error: ${err.message || "Failed"}`, { error: true });
    figma.ui.postMessage({
      type: "error",
      message: err.message || "Execution error",
    });
  }
};
