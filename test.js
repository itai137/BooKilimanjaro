app.post("/search", async (req, res) => {
    try {
      if(!is_adding){ //no added items
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
        }};

        
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