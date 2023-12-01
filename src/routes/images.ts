import express from "express";
import fileUpload, { UploadedFile } from "express-fileupload";
import { fileTypeFromFile } from "file-type";
import { getImagesDb } from "../db.js";
import { ObjectId } from "mongodb";
import {
  validateImage,
  validateImagePartial,
} from "../data_types/validation.js";
import { fetchImage, postImage, deleteImage } from "../fileServer/api.js";
import addImageLink from "../utils/addImageLink.js";
import getUserId from "../utils/getUserId.js";

const router = express.Router();

router.use(
  fileUpload({
    limits: {
      fileSize: 20000000,
    },
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: "../../temp/",
    safeFileNames: true,
    preserveExtension: 4,
    parseNested: true,
  })
);

router.get("/", async (req, res, next) => {
  try {
    const db = getImagesDb();
    const cursor = db.collection("Test_images").find();
    const data = [];

    for await (const item of cursor) {
      data.push(item);
    }

    if (data) {
      return res.json(data);
    }

    res.status(404).send("Not found");
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = getImagesDb();
    const data = await db
      .collection("Test_images")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (data) {
      return res.json(data);
    }

    res.status(404).send("Not found");
  } catch (error) {
    next(error);
  }
});

router.get("/file/:id", async (req, res, next) => {
  try {
    const data = await fetchImage(req.params.id);
    if (data.error) {
      return res.status(404).send("Not found");
    }

    res.json((data.result as Response).body);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body;

    const validate = validateImage(body);
    if (!validate.success) {
      return res.status(400).json(validate.error.issues);
    }

    body.dateAdded = Date.now();

    const { objectLink } = body;
    body.objectLink = "";

    const file = req.files?.image as UploadedFile;
    if (!file) {
      return res.status(400).send("Image file missing");
    }

    const type = await fileTypeFromFile(file.tempFilePath);
    let fileFormat;
    switch (type?.mime as string) {
      case "image/jpeg":
      case "image/bmp":
      case "image/webp":
      case "image/png":
        fileFormat = "." + type!.ext;
        break;

      default:
        return res.status(400).send("Only images (png/bmp/webp/jpg) allowed");
    }

    const userId = getUserId();

    const { error, postResponse } = await postImage(
      file.tempFilePath,
      fileFormat,
      userId
    );

    if (error) {
      throw Error("Couldnt save image file: " + error);
    }

    body.filePath = postResponse.filePath;

    const db = getImagesDb();
    const imageAttempt = await db.collection("Test_images").insertOne(body);

    if (!imageAttempt.insertedId) {
      throw Error("Couldnt save image data");
    }

    body._id = imageAttempt.insertedId;

    if (objectLink !== "") {
      const addedObjectLink = await addImageLink(
        objectLink,
        imageAttempt.insertedId.toString()
      );

      const updateObject = { $set: { objectLink: addedObjectLink } };
      const linkToObjectAttempt = await db
        .collection("Test_images")
        .updateOne(
          { _id: new ObjectId(imageAttempt.insertedId) },
          updateObject
        );

      if (linkToObjectAttempt.matchedCount === 1) {
        body.objectLink = addedObjectLink;
        return res.status(201).json(body);
      }
    }

    res.status(201).json(body);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = getImagesDb();
    const attempt = await db
      .collection("Test_images")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (attempt.deletedCount === 1) {
      return res.status(204).send("Deleted");
    }

    res.status(404).send("Not found");
  } catch (error) {
    next(error);
  }
});

router.delete("/file/:id", async (req, res, next) => {
  try {
    const attempt = await deleteImage(req.params.id);
    if (attempt.error) {
      return res.status(404).send("Not found");
    }

    res.json((attempt.result as Response).body);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body;
    const validate = validateImagePartial(body);
    if (!validate.success) {
      return res.status(400).json(validate.error.issues);
    }

    const updateObject = { $set: body };
    const db = getImagesDb();
    const attempt = await db
      .collection("Test_images")
      .updateOne({ _id: new ObjectId(req.params.id) }, updateObject);

    if (attempt.matchedCount === 1) {
      return res.status(204).send("Updated");
    }

    res.status(404).send("Not found");
  } catch (error) {
    next(error);
  }
});

export default router;
