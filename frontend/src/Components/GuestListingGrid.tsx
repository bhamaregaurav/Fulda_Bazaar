import '../Style/pages/guest-listing.scss';

import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import type { ProductsState } from "@/types/listing";
import { useAppDispatch } from '../store';
import { fetchListings } from "../features/products/productsSlice";

import {
  Card,
  CardContent,
  CardHeader,
} from "./ui/card";
import { Link } from 'react-router-dom';

export const GuestListingGrid = () => {
  const dispatch = useAppDispatch();


  const { items: listings, status } = useSelector(
    (state: RootState) => state.products
  ) as ProductsState;

  useEffect(() => {
    if (status === "idle") {
      dispatch(
        fetchListings({
          query: "",
          category_id: 0,
          subcategory_id: 0,
          min_price: "",
          max_price: "",
          condition: "",
          location: "",
        })
      );
    }
  }, [dispatch, status]);

  return (
    <div className="listing-grid">
      {listings.map((listing) => {
        if (!listing || !listing.images) return null;

        return (
          <div className="listing-item" key={listing.listing_id}>
            <Card className='listing-card'>
              <CardHeader>
                <img src={listing.images[0]} />
              </CardHeader>
              <div className="card-heading">
                <CardContent>{listing.title}</CardContent>
                <Link to={`/listing/${listing.listing_id}`}>more</Link>
              </div>
              <CardContent>
                <p>{listing.price}</p>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
