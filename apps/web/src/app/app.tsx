import RootLayout from "@/app/layout";
import Page from "@/app/page";

/** The whole editor; the index route loads it in the browser only. */
export default function App() {
  return (
    <RootLayout>
      <Page />
    </RootLayout>
  );
}
