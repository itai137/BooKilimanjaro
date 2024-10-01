# BooKilimanjaro

📚 BookiliManjaro Project

Welcome to BookiliManjaro! This project is a simple web application for managing a list of books, allowing you to search, add, and delete books from your collection.

🚀 Getting Started

Follow the steps below to set up and run the project on your local machine.

Prerequisites
Make sure you have the following installed:

Node.js: Download and install Node.js
PostgreSQL: You need a PostgreSQL instance for the database.

📦 Installation

Use npm to install the required dependencies:


npm install

🛠️ Configuration
Create a .env File:

Create a .env file in the root of the project to store your database credentials:


DB_USER=your_database_user
DB_HOST=localhost
DB_DATABASE=capstone-books
DB_PASSWORD=your_database_password
DB_PORT=5432
Replace the values with your PostgreSQL credentials.

💻 Running the Server
To start the server, use the following command:


npx nodemon index.js
This will start the server with nodemon, which automatically restarts the server when you make changes.

Alternatively, you can start the server using Node.js directly:


node index.js
The server should be running at http://localhost:3000.

🔧 Available Commands
Install Dependencies:


npm install
Run the Server with Nodemon:


npx nodemon index.js
Run the Server without Nodemon:


node index.js
🗃️ Database Setup
The project requires a PostgreSQL database. Use the following steps to set up the database:

Create the Database:


CREATE DATABASE capstone-books;
Create the Tables:

Connect to your PostgreSQL instance and create the necessary tables using the SQL commands:


CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    cover TEXT,
    year INT
);

CREATE TABLE search_results (
    result_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    cover_i TEXT,
    year INT,
    first_sentence TEXT
);

🔍 Project Structure
index.js: Main server file where routes and server configuration are defined.
views/: Contains the EJS templates for rendering pages.
public/: Static files like CSS, images, etc.
partials/: Header and footer templates for consistent layout across pages.

🌐 Routes Overview
GET /: Displays your list of saved books.
POST /search: Searches for books and displays search results.
POST /add: Adds a book from the search results to your list.
POST /delete: Deletes a book from your list.
POST /sort: Sorts the book list based on selected criteria (e.g., title or date added).

🛠️ Technologies Used
Node.js and Express.js: For server-side code and routing.
PostgreSQL: Database for storing book information.
EJS: Template engine for rendering dynamic HTML.
Axios: For making API requests to external book APIs.
CSS: For styling the application.

🤝 Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue if you find bugs or have suggestions for improvements.



💬 Contact
For questions or suggestions, feel free to contact me at itai137@gmail.com