import Navbar from "../../components/Navbar";
import Herocard from "../../components/Herocards";
import "./home.css";
import Category from "../../components/Category";
import Products from "../../components/Products";


function home(){
    return(
        <div className="home-page">
            <Navbar/>
            <main>
            <Herocard/>
            <Category/>
            <Products/>
            </main>
            
        </div>
    )
}

export default home;
