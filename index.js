require("dotenv").config();
const express = require("express");
var _ = require("lodash");
const https = require("https");

const app = express();
app.use(express.json());

// Middleware - retrive blog data
app.use(
  _.memoize(async (req, res, next) => {
    try {
      const options = {
        hostname: process.env.HOST,
        method: "GET",
        path: process.env.REQ_PATH,
        headers: {
          "x-hasura-admin-secret": process.env.REQ_SECRET,
        },
      };
      const request = https.request(options, async (response) => {
        let blogData = "";
        response.on("data", (chuck) => {
          blogData += chuck;
        });
        response.on("end", () => {
          if (!blogData)
            throw new Error("No data retrived from external server.");
          res.locals.blogData = JSON.parse(blogData).blogs;
          next();
        });
      });
      request.on("error", (e) => {
        console.error(`problem with request: ${e.message}`);
        throw new Error(e.message);
      });
      request.end();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  })
);

// Endpoint that returns the analysis
app.get("/api/blog-stats", async (req, res) => {
  try {
    const noOfBlogs = _.size(res.locals.blogData);
    const blogWithLongestTitle = _.result(
      _.maxBy(res.locals.blogData, (blog) => blog.title.length),
      "title"
    );
    const noOfPrivacyRelatedBlogs = _.size(
      _.filter(res.locals.blogData, (blog) => {
        return _.includes(_.toLower(blog.title), "privacy");
      })
    );
    const uniqueBlogs = _.filter(
      _.uniqBy(res.locals.blogData, (blog) => blog.title),
      (blog) => {
        return (
          _.filter(res.locals.blogData, (blg) => blg.title === blog.title)
            .length === 1
        );
      }
    );

    const uniqueBlogTitles = _.map(uniqueBlogs, (blog) => blog.title);

    res.status(200).json({
      noOfBlogs,
      blogWithLongestTitle,
      noOfPrivacyRelatedBlogs,
      uniqueBlogTitles,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/blog-search", (req, res) => {
  try {
    const query = req.query.query;
    const blogData = res.locals.blogData;
    if (!query) throw new Error("No query provided");

    const matchingBlogs = blogData.filter((blog) => {
      return blog.title.includes(query);
    });

    res.status(200).json(matchingBlogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serving
app.listen(3000, () => {
  console.log("App running on port 3000");
});
