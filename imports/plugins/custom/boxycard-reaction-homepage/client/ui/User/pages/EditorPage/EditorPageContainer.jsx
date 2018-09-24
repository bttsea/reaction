import React, {Component} from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom";
import {composeWithTracker} from "@reactioncommerce/reaction-components";
import EditorPage from './EditorPage'
import {Reaction} from "/client/api";
import {Meteor} from "meteor/meteor";
import {Shops, Tags, Products} from "/lib/collections";
import getCart from "../../../../../../../core/cart/client/util/getCart";
import {Logger} from "../../../../../../../../../client/api";
import {getAnonymousCartsReactive, storeAnonymousCart} from "../../../../../../../core/cart/client/util/anonymousCarts";
import {ReactionProduct} from "../../../../../../../../../lib/api";
import {Router} from "../../../../../../../../../client/modules/router";
import CheckoutModal from "./CheckoutModal"
import Blaze from "meteor/gadicc:blaze-react-component";

class EditorPageContainer extends Component {

  constructor(props) {
    super(props);

    this.toggleModal.bind(this);
    this.state = { showModal: false };
  }


  toggleModal = () => {
    console.log("Modal toggled");
    this.setState({
      showModal: !this.state.showModal
    });
  }

  onAddToCartSuccess() {
    Meteor.call("boxycard/letsboxy");
    console.log("Calling toggle modal!")
    this.toggleModal();
  }

  handleLetsPrint = () => {



    const currentProduct = this.props.products.shift();
    let productId=currentProduct._id;
    let quantity = 1;
    ReactionProduct.setProduct(productId);
    const topVariants = ReactionProduct.getTopVariants(currentProduct._id);
    const currentVariant=topVariants.shift();

    if (productId) {
      const shop = Shops.findOne(Reaction.getPrimaryShopId());
      const shopCurrency = (shop && shop.currency) || "USD";
      console.log(`Current Product ${currentProduct._id} currentVariant${currentVariant._id}`);

      const items = [{
        price: {
          amount: currentVariant.price,
          currencyCode: shopCurrency
        },
        productConfiguration: {
          productId,
          productVariantId: currentVariant._id
        },
        quantity: quantity || 1
      }];

      const {cart} = getCart();
      if (cart) {
        const storedCarts = getAnonymousCartsReactive();
        let token = null;
        if (storedCarts && storedCarts.length) {
          token = storedCarts[0].token; // eslint-disable-line prefer-destructuring
        }
        Meteor.call("cart/addToCart", cart._id, token, items, (error) => {
          if (error) {
            Logger.error(error);
            Alerts.toast(error.message, "error");
            return;
          }

          this.onAddToCartSuccess();
        });
      } else {
        Meteor.call("cart/createCart", items, (error, result) => {
          if (error) {
            Logger.error(error);
            Alerts.toast(error.message, "error");
            return;
          }

          const {
            cart: createdCart,
            incorrectPriceFailures,
            minOrderQuantityFailures,
            token
          } = result;

          if (incorrectPriceFailures.length) {
            Logger.info("incorrectPriceFailures", incorrectPriceFailures);
            Alerts.toast("Prices have changed. Please refresh the page.", "error");
          } else if (minOrderQuantityFailures.length) {
            Logger.info("minOrderQuantityFailures", minOrderQuantityFailures);
            Alerts.toast(`You must order at least ${minOrderQuantityFailures[0].minOrderQuantity} of this item`, "error");
          }

          if (createdCart) {
            if (token) {
              storeAnonymousCart({_id: createdCart._id, shopId: shop && shop._id, token});
            }
            this.onAddToCartSuccess();
          }
        });
      }
    }


  }

  render() {
    return (
      <div>


      <EditorPage products={this.props.products}
                  handleLetsPrint={this.handleLetsPrint.bind(this)}
      />
        <button
          className="btn show-modal"
          onClick={() =>
            this.setState({
              showModal: !showModal
            })
          }
        >
          Show Modal
        </button>

        <CheckoutModal
          header="Boxycard Checkout"
          open={this.state.showModal}
          onClose={() =>
            this.setState({
              showModal: false
            })
          }
        >
          <Blaze template="cartCheckout" />
        </CheckoutModal>
      </div>
   )
  }


}


EditorPageContainer.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object)
};


function composer(props, onData) {
  const queryParams = Object.assign({}, Reaction.Router.current().queryParams);

  if (Meteor.subscribe("Products").ready()) {
    const products = Products.find().fetch();
    onData(null, {products});
  }

}

export default composeWithTracker(composer)(EditorPageContainer);
