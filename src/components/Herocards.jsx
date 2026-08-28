import React, { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiPlay,
} from "react-icons/fi";
import item from "../assets/item.webp";
import items from "../assets/items.png";
import leaf from "../assets/leaf.png";
import fruit from "../assets/fruit.png";
import drinks from "../assets/drinks.png";

import "../index.css";

const heroSlides = [
  {
    discount: "30%",
    title: "Everything you need",
    highlight: "Shop all",
    description: "Everything you need,all in one place. Shop quality products made for every need and every moment.",
    image: item,
  },

  {
    discount: "40%",
    title: "Taste Our",
    highlight: "Fresh Fruits",
    description:
      "Fresh, juicy, and naturally delicious fruits, carefully selected to bring freshness and goodness to every bite.",
    image: fruit,
  },

  {
    discount: "30%",
    title: "Discover Our",
    highlight: "Special Products",
    description:
      "Discover something special with our handpicked products, chosen to make your shopping experience even better.",
    image: items,
  },
  {
    discount: "50%",
    title: "Enjoy Our",
    highlight: "Drinks",
    description:
      "Refresh your day with delicious drinks made to keep every sip cool, fresh, and enjoyable.",
    image: drinks,
  },

];

const Herocards = () => {

  const [currentSlide, setCurrentSlide] = useState(0);

  /* Auto slide */

  useEffect(() => {

    const timer = setInterval(() => {

      setCurrentSlide((prev) =>
        prev === heroSlides.length - 1
          ? 0
          : prev + 1
      );

    }, 5000);

    return () => clearInterval(timer);

  }, []);


  const slide = heroSlides[currentSlide];


  return (
    <section className="hero-card" id="home">
      <div className="background">
      <img src={leaf} alt="img"/>
      </div>
      {/* Left Content */}

      <div className="hero-content">

        <h1>
          {slide.title}
          <br />
          <strong>{slide.highlight}</strong>
        </h1>

        <p>
          {slide.description}
        </p>

        <div className="hero-buttons">

          <button className="explore-button">
            <span>Explore Now</span>

            <i>
              <FiArrowRight size={20} />
            </i>
          </button>

          <button className="order-button">
            <i>
              <FiPlay />
            </i>
            <span>How To Order</span>

          </button>
        </div>

      </div>


      {/* Food Image */}

      <div className="hero-image-area">
        <div className="hero-discount">
          <span>{slide.discount}</span>
          <strong>OFF</strong>
        </div>
        <img
          key={slide.image}
          src={slide.image}
          alt={slide.highlight}
          className="hero-image"
        />

      </div>


      {/* Dots */}

      <div className="hero-dots">

        {heroSlides.map((_, index) => (

          <button
            key={index}
            className={
              index === currentSlide
                ? "hero-dot active"
                : "hero-dot"
            }
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />

        ))}

      </div>

    </section>
  );
};

export default Herocards;