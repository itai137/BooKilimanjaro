import express, { query } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";



const app = express();
const port = 3000; 
const saltRounds = 10;
env.config();


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

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

app.get("/", (req, res) => {
  res.render("home.ejs",
    { isAuthenticated: req.isAuthenticated() }
  );
});

app.get("/login", (req, res) => {
  res.render("login.ejs",
    { isAuthenticated: req.isAuthenticated() });
});

app.get("/register", (req, res) => {
  res.render("register.ejs",
    { isAuthenticated: req.isAuthenticated() });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/list",
  passport.authenticate("google", {
    successRedirect: "/list",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
  req.logout((err)=> {
    if(err) console.log(err);
    res.render("home.ejs",
      { isAuthenticated: req.isAuthenticated() });
  });
  
});




app.get("/list", async (req, res) => {
  if (req.isAuthenticated()) {
    isNotMainPage = 0;
    try {
      
      books = await db.query("SELECT * FROM books WHERE username = $1 ORDER BY id DESC",
        [req.user.username]);
      //console.log(books.rows);
      res.render("index.ejs", {
              books: books.rows,
              isAuthenticated: req.isAuthenticated(),    
    });
    }catch (err) {
      console.error(err);
      
    }
  } else {
    res.redirect("/login");
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
         isAuthenticated: req.isAuthenticated() ,
      });
    } catch (err) {
      console.error("Error fetching search results:", err);
      res.status(500).send("Something went wrong while fetching the search results.");
    }
  });


//-------app.post-------------

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/list",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.render("login.ejs",
        { isAuthenticated: req.isAuthenticated() }); //and alerts user is already exist
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.render("index.ejs",
              { isAuthenticated: req.isAuthenticated() });
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
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
         isAuthenticated: req.isAuthenticated(),
      });
    
    
    
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
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
      books = await db.query(`SELECT * FROM books WHERE username = $1 ORDER BY id DESC`,[req.user.username]);
    } else if (sort_by=="rate") { 
      books = await db.query(`SELECT * FROM books WHERE username = $1 ORDER BY rate DESC`,[req.user.username]);
    } else{
      books = await db.query(`SELECT * FROM books WHERE username = $1 ORDER BY ${sort_by} ASC`,[req.user.username]);
    }
    
    res.render("index.ejs", {
            books: books.rows,
             isAuthenticated: req.isAuthenticated(),    
  });
  }catch (err) {
    console.error(err);
    
  }
  
});


//---------passport-----------

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);


passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/list",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE username = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (username, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});