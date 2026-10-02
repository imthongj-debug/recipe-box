const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, "data", "recipes.json");
const CLIENT_DIR = path.join(__dirname, "..", "client");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB ต่อรูป

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// รูปถูกส่งมาเป็น base64 ใน JSON จึงต้องเพิ่มขนาด limit
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(CLIENT_DIR));

function readRecipes() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (error) {
        console.error("อ่าน recipes.json ไม่สำเร็จ:", error);
        return [];
    }
}

function writeRecipes(recipes) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(recipes, null, 2), "utf8");
}

// ---------- จัดการรูปภาพ ----------
const IMAGE_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
};
const UPLOAD_PATH_RE = /^\/uploads\/[\w-]+\.(jpg|png|webp|gif)$/;

// รับ data URL (data:image/jpeg;base64,...) -> บันทึกไฟล์ -> คืน path เช่น /uploads/xxx.jpg
function saveImageFromDataUrl(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
        throw new Error("ไฟล์รูปไม่ถูกต้อง (รองรับ JPG, PNG, WEBP, GIF)");
    }

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("รูปภาพต้องมีขนาดไม่เกิน 5 MB");
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${IMAGE_EXT[match[1]]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    return `/uploads/${filename}`;
}

function deleteImageFile(imagePath) {
    if (typeof imagePath !== "string" || !UPLOAD_PATH_RE.test(imagePath)) return;
    const file = path.join(UPLOAD_DIR, path.basename(imagePath));
    fs.unlink(file, () => {});
}

// ตรวจค่า image จาก body: คืน null ถ้าไม่มี, data URL ถ้าเป็นรูปใหม่, path เดิมถ้าใช้รูปเดิม
function validateImageField(image) {
    if (image === undefined || image === null || image === "") return null;
    if (typeof image !== "string") return "รูปแบบรูปภาพไม่ถูกต้อง";
    if (image.startsWith("data:")) return null;
    if (UPLOAD_PATH_RE.test(image)) return null;
    return "รูปแบบรูปภาพไม่ถูกต้อง";
}

function validateRecipe(body) {
    const { name, category, ingredients, steps, time } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
        return "กรุณาระบุชื่อสูตรอาหาร";
    }

    if (!category || typeof category !== "string" || !category.trim()) {
        return "กรุณาระบุหมวดหมู่";
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0 ||
        ingredients.some(item => typeof item !== "string" || !item.trim())) {
        return "กรุณาระบุวัตถุดิบอย่างน้อย 1 รายการ";
    }

    if (!steps || typeof steps !== "string" || !steps.trim()) {
        return "กรุณาระบุวิธีทำ";
    }

    if (time !== undefined && (Number.isNaN(Number(time)) || Number(time) < 1)) {
        return "เวลาในการทำต้องเป็นตัวเลขที่มากกว่า 0";
    }

    const imageError = validateImageField(body.image);
    if (imageError) {
        return imageError;
    }

    return null;
}

// GET /api/recipes
// รองรับ query: ?search=... และ ?category=...
app.get("/api/recipes", (req, res) => {
    let recipes = readRecipes();

    const search = String(req.query.search || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim().toLowerCase();

    if (search) {
        recipes = recipes.filter(recipe => {
            const text = [
                recipe.name,
                recipe.category,
                ...recipe.ingredients
            ].join(" ").toLowerCase();

            return text.includes(search);
        });
    }

    if (category) {
        recipes = recipes.filter(recipe =>
            recipe.category.toLowerCase() === category
        );
    }

    res.status(200).json(recipes);
});

// GET /api/recipes/:id
app.get("/api/recipes/:id", (req, res) => {
    const id = Number(req.params.id);
    const recipes = readRecipes();
    const recipe = recipes.find(item => item.id === id);

    if (!recipe) {
        return res.status(404).json({
            message: "ไม่พบสูตรอาหารที่ต้องการ"
        });
    }

    res.status(200).json(recipe);
});

// POST /api/recipes
app.post("/api/recipes", (req, res) => {
    const error = validateRecipe(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    const recipes = readRecipes();
    const newId = recipes.length
        ? Math.max(...recipes.map(recipe => recipe.id)) + 1
        : 1;

    let image = null;
    if (typeof req.body.image === "string" && req.body.image.startsWith("data:")) {
        try {
            image = saveImageFromDataUrl(req.body.image);
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }
    }

    const newRecipe = {
        id: newId,
        name: req.body.name.trim(),
        category: req.body.category.trim(),
        ingredients: req.body.ingredients.map(item => item.trim()).filter(Boolean),
        steps: req.body.steps.trim(),
        time: Number(req.body.time) || 15,
        image
    };

    recipes.push(newRecipe);
    writeRecipes(recipes);

    res.status(201).json(newRecipe);
});

// PUT /api/recipes/:id
app.put("/api/recipes/:id", (req, res) => {
    const id = Number(req.params.id);
    const error = validateRecipe(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    const recipes = readRecipes();
    const index = recipes.findIndex(recipe => recipe.id === id);

    if (index === -1) {
        return res.status(404).json({
            message: "ไม่พบสูตรอาหารที่ต้องการแก้ไข"
        });
    }

    const oldImage = recipes[index].image || null;
    let image = oldImage;

    if (typeof req.body.image === "string" && req.body.image.startsWith("data:")) {
        // อัปโหลดรูปใหม่
        try {
            image = saveImageFromDataUrl(req.body.image);
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }
    } else if (!req.body.image) {
        // ผู้ใช้กดลบรูป
        image = null;
    } else if (req.body.image !== oldImage) {
        // ไม่อนุญาตให้ชี้ไปยังรูปของสูตรอื่น
        image = oldImage;
    }

    if (oldImage && oldImage !== image) {
        deleteImageFile(oldImage);
    }

    const updatedRecipe = {
        id,
        name: req.body.name.trim(),
        category: req.body.category.trim(),
        ingredients: req.body.ingredients.map(item => item.trim()).filter(Boolean),
        steps: req.body.steps.trim(),
        time: Number(req.body.time) || 15,
        image
    };

    recipes[index] = updatedRecipe;
    writeRecipes(recipes);

    res.status(200).json(updatedRecipe);
});

// DELETE /api/recipes/:id
app.delete("/api/recipes/:id", (req, res) => {
    const id = Number(req.params.id);
    const recipes = readRecipes();
    const index = recipes.findIndex(recipe => recipe.id === id);

    if (index === -1) {
        return res.status(404).json({
            message: "ไม่พบสูตรอาหารที่ต้องการลบ"
        });
    }

    const [removed] = recipes.splice(index, 1);
    writeRecipes(recipes);
    deleteImageFile(removed.image);

    res.status(204).send();
});

// ถ้าเข้าหน้าอื่น ให้กลับไปหน้าเว็บหลัก
app.get("*", (req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

app.listen(PORT, () => {
    console.log(`🍳 Recipe Box running at http://localhost:${PORT}`);
});
