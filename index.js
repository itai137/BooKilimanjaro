import express, { query } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";



const app = express();
const port = 3000; 
env.config();


app.use(
  session({
    secret: "TOPSECRETCAPSTONEBOOK",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();

// let books =[
//   { id: 1, title: "Eat That Frog!", author: "Brian Tracy", cover: "https://covers.openlibrary.org/b/isbn/9785961411386-L.jpg"},
//   { id: 2, title: "The Great Gatsby", author: "F. Scott Fitzgerald", cover: "https://covers.openlibrary.org/b/isbn/9783257236927-L.jpg" },
// ];
let books =[];
let isNotMainPage = 0;

app.get("/", async (req, res) => {
  isNotMainPage = 0;
    try {
      
      books = await db.query("SELECT * FROM books ORDER BY id DESC");
      // console.log(books.rows);
      res.render("index.ejs", {
              books: books.rows    
    });
    }catch (err) {
      console.error(err);
      
    }
    
  });
  
app.post("/search", async (req, res) => {
  try {
    
      // Cleaning the results table
    await db.query("DELETE FROM search_results");

    const input = req.body.query;
    const response = await axios.get(`https://openlibrary.org/search.json?title=${input}`);
    const data = response.data;

    if (data.numFound > 0) {
      // Iterate through the top 5 books
      for (let book of data.docs.slice(0, 5)) {
        const title = book.title || 'Unknown Title';
        const author = book.author_name ? book.author_name.join(", ") : 'Unknown Author';
        const cover_i = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` || null;
        const year = book.first_publish_year || null;
        const first_sentence = book.first_sentence ? book.first_sentence[0] : null;
        const rate = book.ratings_average || null;
        const isbn = book.isbn ? book.isbn[0] : 'Unknown Isbn';

        // Insert the book into the search_results table
        await db.query(
          `INSERT INTO search_results (title, author, cover_i, year, first_sentence, rate, isbn)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [title, author, cover_i, year, first_sentence, rate, isbn]
        );
      }

      } else {
          res.status(404).send("No books found for the given title.");
      };

      
      // Fetch the search results with an additional check for whether they are in the favorite list
      const bookResults = await db.query(`
        SELECT sr.*, 
        CASE 
          WHEN b.id IS NOT NULL THEN true 
          ELSE false 
        END as is_favorite
        FROM search_results sr
        LEFT JOIN books b ON sr.isbn = b.isbn
      `);

      res.render("search.ejs", {
        books: bookResults.rows,
      });
    
    
    
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});
  

app.get("/search", async (req, res) => {
  try {
    // Fetch the current search results from the `search_results` table
    const bookResults = await db.query(`
      SELECT sr.*, 
      CASE 
        WHEN b.id IS NOT NULL THEN true 
        ELSE false 
      END as is_favorite
      FROM search_results sr
      LEFT JOIN books b ON sr.isbn = b.isbn
    `);

    res.render("search.ejs", {
      books: bookResults.rows,
    });
  } catch (err) {
    console.error("Error fetching search results:", err);
    res.status(500).send("Something went wrong while fetching the search results.");
  }
});


app.post("/add", async (req, res) => {
  isNotMainPage=1;
  try {
    const chosenBookID = req.body.list;

    // First, fetch the book from search_results
    const selectedBook = await db.query("SELECT result_id, title, author, cover_i, rate, isbn FROM search_results WHERE isbn = $1", [chosenBookID]);

    if (selectedBook.rows.length === 0) {
      // If the book doesn't exist in the search_results table, send an error response
      return res.status(404).send("Book not found in search results.");
    }

    try {
      // Attempt to insert the book into the books table
      await db.query(
        "INSERT INTO books (id, title, author, cover, year, created_at, first_sentence, rate, isbn) SELECT result_id, title, author, cover_i, year, created_at, first_sentence, rate, isbn  FROM search_results WHERE isbn = $1",
        [chosenBookID]
      );

      // If successful, stay on the search page
      res.redirect("/search");
    } catch (insertErr) {
      // If the insertion fails (likely due to a duplicate key error), handle it here
      console.error("Error inserting book:", insertErr);
      res.status(400).send("This book is already in your list.");
    }
  } catch (err) {
    console.error("Error moving data to books table:", err);
    res.status(500).send("Something went wrong while moving the data.");
  }
});


app.post("/delete", async (req, res) => {
  try {
    const bookID = req.body.book_id; // Extract book ID from form

    // Delete the book with the given ID
    const deleteResult = await db.query("DELETE FROM books WHERE isbn = $1", [bookID]);

    // Check if the row was actually deleted
    if (deleteResult.rowCount > 0) {
      // Redirect back to the home page after successful deletion
      if(isNotMainPage){
        res.redirect("/search");
      } else{
        res.redirect("/");
      }
      
    } else {
      console.error("No book found with that ID to delete.");
      res.status(404).send("No book found with that ID to delete.");
    }
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).send("Something went wrong while deleting the book.");
  }
});

app.post("/sort", async (req, res) => {
  try {
    const sort_by = req.body.sort;

    if (sort_by=="id") { 
      books = await db.query(`SELECT * FROM books ORDER BY id DESC`);
    } else if (sort_by=="rate") { 
      books = await db.query(`SELECT * FROM books ORDER BY rate DESC`);
    } else{
      books = await db.query(`SELECT * FROM books ORDER BY ${sort_by} ASC`);
    }
    
    res.render("index.ejs", {
            books: books.rows    
  });
  }catch (err) {
    console.error(err);
    
  }
  
});




app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});