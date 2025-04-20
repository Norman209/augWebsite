import cv2
import numpy as np
from PIL import Image, ImageFilter
import os
os.environ["ALBUMENTATIONS_IGNORE_VERSION"] = "1"
import albumentations as A
os.environ["ALBUMENTATIONS_IGNORE_VERSION"] = "1"
from matplotlib import pyplot as plt
# def apply_gaussian_blur(image_path, base_sigma, output_path):
#     image = Image.open(image_path)

#     # Apply blur
#     blurred_image = image.filter(ImageFilter.GaussianBlur(radius=base_sigma))

#     # Save the modified image
#     blurred_image.save(output_path)

def apply_gaussian_blur(image_path, base_sigma, output_path):
    image = Image.open(image_path) #cv2 imread image instead of pil image

    # Apply Gaussian Blur
    blur_radius = base_sigma  # Adjust the radius as needed
    blurred_image = image.filter(ImageFilter.GaussianBlur(radius=blur_radius*2.3))

    # Save the blurred image
    blurred_image.save(output_path)


def visualize(image):
    cv2.imshow('Image', image)

    # Wait for a key press indefinitely or for a specified amount of time in milliseconds
    cv2.waitKey(0)
    cv2.destroyAllWindows()

def apply_rotate(image_path,deg,save_path):
    transform = A.Compose([
    A.Rotate(always_apply=True, p=1.0, limit=(deg, deg), interpolation=0, border_mode=0, value=(0, 0, 0), mask_value=None, rotate_method='largest_box', crop_border=False),  # Rotate images by a random angle between -45 and 45 degrees
    ])
    image = cv2.imread(image_path)
    # image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    augmented = transform(image=image)
    rotated_image = augmented['image']
    cv2.imwrite(save_path, rotated_image)

def apply_clockwise(image_path,save_path):
    apply_rotate(image_path,-90,save_path)
    
def apply_counter_clockwise(image_path,save_path):
    apply_rotate(image_path,90,save_path)

def apply_upside_down(image_path,save_path):
    apply_rotate(image_path,180,save_path)

def crop(image_path, percentage, save_path):
    image = cv2.imread(image_path)
    height = image.shape[0]
    width = image.shape[1]
    transform = A.Compose([
    A.CenterCrop(height=round(height*((100-percentage)/100)), width=round(width*((100-percentage)/100))),
    A.Resize(height=height, width=width)
    ])
    augmented = transform(image=image)
    cropped_image = augmented['image']
    cv2.imwrite(save_path, cropped_image)



