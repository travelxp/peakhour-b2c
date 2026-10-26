import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/blocks/item";

const person1 = {
  name: "Jack Walsh",
  firstName: "Jack",
  lastName: "Walsh",
  initials: "JW",
  email: "jack.walsh@example.com",
  username: "jackwalsh",
  role: "Product Designer",
  company: "Cartwright",
  location: "Brisbane, Australia",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar1.webp",
};
const person2 = {
  name: "Ilze Pērkone",
  firstName: "Ilze",
  lastName: "Pērkone",
  initials: "MK",
  email: "iperkone@example.com",
  username: "iperkone",
  role: "Brand Director",
  company: "Kivit",
  location: "Rīga, Latvia",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar2.webp",
};
const person3 = {
  name: "Vernon Desilets",
  firstName: "Vernon",
  lastName: "Desilets",
  initials: "VD",
  email: "vernod@example.com",
  username: "vernod",
  role: "Creative Director",
  company: "Soho Logix",
  location: "Paris, France",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar3.webp",
};

export const title = "Activity Feed";

const events = [
  {
    id: "1",
    name: person1.name,
    initials: person1.initials,
    avatar: person1.avatar,
    action: "approved the deploy checklist",
    time: "4 minutes ago",
  },
  {
    id: "2",
    name: person2.name,
    initials: person2.initials,
    avatar: person2.avatar,
    action: "exported the April invoice batch",
    time: "28 minutes ago",
  },
  {
    id: "3",
    name: person3.name,
    initials: person3.initials,
    avatar: person3.avatar,
    action: "invited a new workspace member",
    time: "1 hour ago",
  },
];

const Example = () => (
  <div className="w-full max-w-md">
    <ItemGroup>
      {events.map((event) => (
        <Item className="bg-background" key={event.id} variant="outline">
          <ItemMedia>
            <Avatar>
              <AvatarImage alt={event.name} src={event.avatar} />
              <AvatarFallback>{event.initials}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {event.name} {event.action}
            </ItemTitle>
            <ItemDescription>{event.time}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  </div>
);

export default Example;
