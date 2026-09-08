import React, { useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import fruits from "../assets/fruits.jpg";
import dairy from "../assets/dairy.png";
import personal from "../assets/personal.png";
import bakery from "../assets/bakery.png";
import household from "../assets/household.webp";
import vegetable from "../assets/vegetable.webp";
import drink from "../assets/drink.jpeg";
import chocolate from "../assets/chocolate.webp";
import pulses from "../assets/pulses.jpg";

import { categories as categoryData } from "../data/category";

import "../index.css";

const categoryImages = {
  Fruits: fruits,
  Vegetables: vegetable,
  Drinks: drink,
  Groceries: pulses,
  Snacks: chocolate,
  Dairy: dairy,
  Bakery: bakery,
  Household: household,
  "Personal Care": personal,
};

const categories = categoryData
  .filter(
    (category) => category !== "All Products"
  )
  .map((category) => ({
    name: category,

    description:
      `Fresh and quality ${category.toLowerCase()} products`,

    image: categoryImages[category],
  }));

const Category = () => {

  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] =
    useState(0);

  const visibleCount = 5;

  const handleNext = () => {

    setActiveIndex((prev) => {

      return (
        (prev + 1) %
        categories.length
      );

    });

  };

  const handlePrevious = () => {

    setActiveIndex((prev) => {

      return (
        (prev - 1 + categories.length) %
        categories.length
      );

    });

  };

  const handleCategoryClick = (category) => {

    navigate(
      `/products?category=${encodeURIComponent(
        category
      )}`
    );

  };

  const visibleCategories = [];

  for (
    let i = 0;
    i < visibleCount;
    i++
  ) {

    const index =
      (activeIndex + i) %
      categories.length;

    visibleCategories.push({

      ...categories[index],

      originalIndex: index,

    });

  }

  return (

    <section className="category-section">

      <div className="category-intro">

        <span>
          Today Menu
        </span>

        <h2>
          Our Menu
        </h2>

        <div className="category-arrows">


          {/* PREVIOUS */}

          <button
            type="button"
            onClick={handlePrevious}
            aria-label="Previous category"
          >
            <FiArrowLeft />
          </button>


          {/* NEXT */}

          <button
            type="button"
            className="next-arrow"
            onClick={handleNext}
            aria-label="Next category"
          >
            <FiArrowRight />
          </button>


        </div>

      </div>

      <div className="category-slider">

        {visibleCategories.map(
          (category) => (

            <div
              key={category.name}

              className={`category-card ${
                category.originalIndex ===
                activeIndex
                  ? "active"
                  : ""
              }`}

              onClick={() =>
                handleCategoryClick(
                  category.name
                )
              }
            >

              <div className="category-image">

                <img
                  src={category.image}
                  alt={category.name}
                />

              </div>

              <h3>
                {category.name}
              </h3>
              <p>
                {category.description}
              </p>


            </div>

          )
        )}

      </div>

    </section>

  );

};


export default Category;