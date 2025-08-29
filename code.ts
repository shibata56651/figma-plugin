figma.showUI(__html__, { width: 300, height: 200 });

// y座標の基準を定義
const Y_STARTS = {
  step: -2258,
  single: -1714,
};

let stepOffset = 0;
let singleOffset = 0;

// === データ取得 ===
async function applyTemplate(item: any) {
  try {
    const { category, stepUpFlg, steps } = item;
    const templateName = stepUpFlg
      ? `${category}_step${steps.length}`
      : `${category}_single`;

    const templateNode = figma.currentPage.findOne(
      (n) => n.type === "GROUP" && n.name === templateName
    ) as FrameNode | null;

    if (!templateNode) throw new Error(`Template node not found: ${templateName}`);

    // === テンプレート複製 ===
    const instance = templateNode.clone();
    instance.name = `${item.id}`;
    figma.currentPage.appendChild(instance);
    instance.x = templateNode.x + 800;

    if (stepUpFlg) {
      instance.y = Y_STARTS.step + stepOffset;
      stepOffset += templateNode.height + 20;
    } else {
      instance.y = Y_STARTS.single + singleOffset;
      singleOffset += templateNode.height + 20;
    }

    // === テキスト適用 ===
    const textNodes: { node: TextNode; value: string }[] = [];
    for (const [key, value] of Object.entries(item.text)) {
      console.log(key, value);
      const node = instance.findOne(
        (n) => n.type === "TEXT" && n.name === key
      ) as TextNode | null;
      if (node) {
        textNodes.push({ node, value: String(value) });
      }
    }

    // === 先にすべてのフォントをロード（target_price も含む） ===
    const fonts = new Set<string>();
    for (const t of textNodes) {
      const font = t.node.fontName === figma.mixed
        ? t.node.getRangeFontName(0, 1)
        : t.node.fontName;
      fonts.add(JSON.stringify(font));
    }

    // Roboto SemiBold も明示的にロードしておく（target_price用）
    fonts.add(JSON.stringify({ family: "Roboto", style: "SemiBold" }));

    for (const fontStr of fonts) {
      await figma.loadFontAsync(JSON.parse(fontStr));
    }

    // === フォント読み込み完了後に characters 設定 ===
    for (const t of textNodes) {
      if (t.node.name === "target_price") {
        const priceValue = t.value;
        t.node.characters = priceValue;

        // テキストノードの自動リサイズを設定（段落ちを防ぐ）
        t.node.textAutoResize = "WIDTH_AND_HEIGHT";

        const yenIndex = priceValue.indexOf("円");
        if (yenIndex !== -1) {
          const fontSemiBold: FontName = { family: "Roboto", style: "SemiBold" };
          t.node.setRangeFontName(yenIndex, yenIndex + 1, fontSemiBold);
          t.node.setRangeFontSize(yenIndex, yenIndex + 1, 42);
        }
      } else {
        t.node.characters = t.value;
      }
    }

    // for (const t of textNodes) {
    //   try {
    //     let font: FontName;
    //     if (t.node.fontName === figma.mixed) {
    //       font = t.node.getRangeFontName(0, 1) as FontName;
    //     } else {
    //       font = t.node.fontName as FontName;
    //     }
    //     await figma.loadFontAsync(font);
    //     t.node.fontName = font;
    //     t.node.characters = t.value;
    //   } catch (err) {
    //     console.error(`❌ テキスト更新失敗: ${t.node.name}`, err);
    //   }
    // }

    // === STEP ノード処理（target_stepX / target_stepX_text）===
    if (stepUpFlg && item.steps.length > 0) {
      const boldFont: FontName = { family: "Noto Sans JP", style: "Bold" };
      const regularFont: FontName = { family: "Noto Sans JP", style: "Regular" };

      await figma.loadFontAsync(boldFont);
      await figma.loadFontAsync(regularFont);

      for (const [index, step] of item.steps.entries()) {
        const stepIndex = index + 1;
        const stepKey = `STEP${stepIndex}`;
        const stepTitle = `STEP${stepIndex}.`;

        const titleNode = instance.findOne(
          (n) => n.type === "TEXT" && n.name === `target_step${stepIndex}`
        ) as TextNode | null;

        const textNode = instance.findOne(
          (n) => n.type === "TEXT" && n.name === `target_step${stepIndex}_text`
        ) as TextNode | null;

        // タイトル部分（STEP1.）
        if (titleNode) {
          try {
            titleNode.fontName = boldFont;
            titleNode.characters = stepTitle;
          } catch (err) {
            console.error(`❌ ${stepKey} タイトルの設定失敗:`, err);
          }
        }

        // テキスト説明部分
        const stepText = step[stepKey]; // 例: "ユーザーレベル40到達で【200円】"
        if (textNode) {
          try {
            textNode.fontName = regularFont;
            textNode.characters = stepText;
          } catch (err) {
            console.error(`❌ ${stepKey} テキストの設定失敗:`, err);
          }
        }
      }
    }


    console.log(`✅ ${item.id} の適用完了`);
  } catch (error) {
    console.error(`❌ ${item.id} の適用失敗: `, error);
  }
}

// === 処理開始 ===
figma.ui.onmessage = async (msg) => {
  const response = await fetch(msg.url);
  const json = await response.json();

  if (msg.type === "apply") {
    for (const item of json) {
      // === 画像処理 ===
      // const imageBytes = await fetch(item.image).then((res) => res.arrayBuffer());
      // const image = figma.createImage(new Uint8Array(imageBytes));

      // const imageNode = figma.currentPage.findOne(
      //   (n) => n.type === "RECTANGLE" && n.name === "target_image"
      // ) as RectangleNode | null;
      // if (imageNode) {
      //   imageNode.fills = [
      //     {
      //       type: "IMAGE",
      //       scaleMode: "FILL",
      //       imageHash: image.hash,
      //     },
      //   ];
      // }

      // === テンプレート適用 ===
      await applyTemplate(item);
    }
    figma.notify("全ての適用が完了しました");
  } else if (msg.type === "export-png") {

  }
};
